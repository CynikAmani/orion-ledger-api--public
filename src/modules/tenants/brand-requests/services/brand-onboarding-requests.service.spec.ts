import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { OnboardingRequestStatus } from '@prisma/client';
import { BRAND_ONBOARDING_AUDIT_ACTIONS } from '../constants/brand-onboarding-audit-actions.constant';
import { BrandOnboardingRequestsService } from './brand-onboarding-requests.service';

describe('BrandOnboardingRequestsService', () => {
  const recordAudit = jest.fn<(...args: unknown[]) => Promise<void>>();
  const sendEmail = jest.fn();
  const refreshEligibility =
    jest.fn<(...args: unknown[]) => Promise<unknown>>();

  const createRequest = jest.fn<(...args: unknown[]) => Promise<unknown>>();
  const findManyRequests = jest.fn<(...args: unknown[]) => Promise<unknown>>();
  const findFirstRequest = jest.fn<(...args: unknown[]) => Promise<unknown>>();
  const findUniqueRequest = jest.fn<(...args: unknown[]) => Promise<unknown>>();
  const updateRequest = jest.fn<(...args: unknown[]) => Promise<unknown>>();
  const findUniqueUser = jest.fn<(...args: unknown[]) => Promise<unknown>>();
  const findFirstTenant = jest.fn<(...args: unknown[]) => Promise<unknown>>();

  const tx = {
    brandOnboardingRequest: {
      findUnique: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      findFirst: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      update: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    },
    user: {
      findUnique: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      update: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    },
    tenant: {
      findFirst: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      create: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    },
    permission: {
      findMany: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    },
    role: {
      create: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    },
    userRole: {
      deleteMany: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      create: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    },
    tenantBrandProfile: {
      create: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    },
    loanApplicationSetting: {
      create: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    },
    notification: {
      create: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    },
  };

  const prisma = {
    brandOnboardingRequest: {
      create: createRequest,
      findMany: findManyRequests,
      findFirst: findFirstRequest,
      findUnique: findUniqueRequest,
      update: updateRequest,
    },
    user: { findUnique: findUniqueUser },
    tenant: { findFirst: findFirstTenant },
    notification: {
      create: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    },
    $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<unknown>) =>
      fn(tx),
    ),
  };

  const now = new Date('2026-09-20T12:00:00.000Z');
  const customerPk = 11;
  const staffPk = 22;
  const requestRow = {
    publicId: 'req-1',
    brandName: 'Acme Finance',
    slug: 'acme-finance',
    tenantCode: 'ACME01',
    contactPhone: '+265999000111',
    contactEmail: 'hello@acme-finance.com',
    status: OnboardingRequestStatus.PENDING,
    rejectionReason: null,
    createdTenantId: null,
    createdAt: now,
    updatedAt: now,
    reviewedAt: null,
    requestedBy: {
      id: customerPk,
      userId: 'customer-1',
      fullname: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: null,
    },
    reviewedBy: null,
  };

  const applicant = {
    id: customerPk,
    userId: 'customer-1',
    email: 'ada@example.com',
    fullname: 'Ada Lovelace',
    tenantId: null,
    deletedAt: null,
    userRoles: [{ role: { key: 'CUSTOMER' } }],
  };

  const auditContext = {
    userId: customerPk,
    userEmail: 'ada@example.com',
  };

  const customerCaller = {
    id: customerPk,
    userId: 'customer-1',
    tenantId: null,
  };

  let service: BrandOnboardingRequestsService;

  beforeEach(() => {
    jest.clearAllMocks();
    findFirstTenant.mockResolvedValue(null);
    findFirstRequest.mockResolvedValue(null);
    findUniqueUser.mockResolvedValue(applicant);
    createRequest.mockResolvedValue(requestRow);
    findUniqueRequest.mockResolvedValue(requestRow);
    updateRequest.mockResolvedValue({
      ...requestRow,
      status: OnboardingRequestStatus.REJECTED,
      rejectionReason: 'Duplicate brand',
      reviewedBy: { userId: 'staff-1', fullname: 'Platform Staff' },
      reviewedAt: now,
    });

    tx.brandOnboardingRequest.findUnique.mockResolvedValue({
      ...requestRow,
      requestedById: customerPk,
    });
    tx.brandOnboardingRequest.findFirst.mockResolvedValue(null);
    tx.tenant.findFirst.mockResolvedValue(null);
    tx.user.findUnique.mockResolvedValue(applicant);
    tx.tenant.create.mockResolvedValue({ tenantId: 'tenant-1' });
    tx.permission.findMany.mockResolvedValue([{ permissionId: 1 }]);
    tx.role.create.mockResolvedValue({
      roleId: 9,
      publicId: 'role-admin',
      key: 'ADMINISTRATOR',
      name: 'Administrator',
    });
    tx.brandOnboardingRequest.update.mockResolvedValue({
      ...requestRow,
      status: OnboardingRequestStatus.APPROVED,
      createdTenantId: 'tenant-1',
      reviewedAt: now,
      reviewedBy: { userId: 'staff-1', fullname: 'Platform Staff' },
    });

    service = new BrandOnboardingRequestsService(
      prisma as never,
      { record: recordAudit } as never,
      { send: sendEmail } as never,
      { refresh: refreshEligibility } as never,
    );
  });

  describe('submit', () => {
    it('rejects callers that already belong to a tenant', async () => {
      await expect(
        service.submit(
          { id: staffPk, userId: 'staff-1', tenantId: 'tenant-1' },
          {
            brandName: 'Acme Finance',
            slug: 'acme-finance',
            tenantCode: 'ACME01',
            contactEmail: 'hello@acme-finance.com',
          },
          auditContext,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects a slug already used by a tenant', async () => {
      findFirstTenant.mockResolvedValue({
        slug: 'acme-finance',
        tenantCode: 'OTHER',
      });

      await expect(
        service.submit(
          customerCaller,
          {
            brandName: 'Acme Finance',
            slug: 'acme-finance',
            tenantCode: 'ACME01',
            contactEmail: 'hello@acme-finance.com',
          },
          auditContext,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('creates a pending request for a platform customer', async () => {
      const created = await service.submit(
        customerCaller,
        {
          brandName: 'Acme Finance',
          slug: 'acme-finance',
          tenantCode: 'ACME01',
          contactEmail: 'hello@acme-finance.com',
          contactPhone: '+265999000111',
        },
        auditContext,
      );

      expect(createRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            requestedById: customerPk,
            slug: 'acme-finance',
            tenantCode: 'ACME01',
            contactEmail: 'hello@acme-finance.com',
          }),
        }),
      );
      expect(recordAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: BRAND_ONBOARDING_AUDIT_ACTIONS.SUBMITTED,
          targetId: 'req-1',
        }),
      );
      expect(created.status).toBe(OnboardingRequestStatus.PENDING);
    });
  });

  describe('reject', () => {
    it('rejects a request that is not pending', async () => {
      findUniqueRequest.mockResolvedValue({
        ...requestRow,
        status: OnboardingRequestStatus.APPROVED,
      });

      await expect(
        service.reject(
          'req-1',
          staffPk,
          { rejectionReason: 'Too late' },
          { userId: staffPk, userEmail: 'staff@test.com' },
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('marks a pending request rejected', async () => {
      const rejected = await service.reject(
        'req-1',
        staffPk,
        { rejectionReason: 'Duplicate brand' },
        { userId: staffPk, userEmail: 'staff@test.com' },
      );

      expect(updateRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: OnboardingRequestStatus.REJECTED,
            rejectionReason: 'Duplicate brand',
            reviewedById: staffPk,
          }),
        }),
      );
      expect(rejected.status).toBe(OnboardingRequestStatus.REJECTED);
      expect(sendEmail).toHaveBeenCalled();
    });
  });

  describe('approve', () => {
    it('returns not found when the request is missing', async () => {
      tx.brandOnboardingRequest.findUnique.mockResolvedValue(null);

      await expect(
        service.approve('missing', staffPk, {}, {
          userId: staffPk,
          userEmail: 'staff@test.com',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('provisions the tenant, attaches the applicant, and notifies them', async () => {
      const approved = await service.approve('req-1', staffPk, {}, {
        userId: staffPk,
        userEmail: 'staff@test.com',
      });

      expect(tx.tenant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Acme Finance',
            slug: 'acme-finance',
            tenantCode: 'ACME01',
            isActive: true,
            trialEndsAt: null,
          }),
        }),
      );
      expect(tx.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tenantId: 'tenant-1' }),
        }),
      );
      expect(tx.userRole.create).toHaveBeenCalled();
      expect(tx.tenantBrandProfile.create).toHaveBeenCalled();
      expect(tx.loanApplicationSetting.create).toHaveBeenCalled();
      expect(tx.notification.create).toHaveBeenCalled();
      expect(tx.brandOnboardingRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: OnboardingRequestStatus.APPROVED,
            createdTenantId: 'tenant-1',
            reviewedById: staffPk,
          }),
        }),
      );
      expect(refreshEligibility).toHaveBeenCalledWith('tenant-1');
      expect(sendEmail).toHaveBeenCalled();
      expect(approved.status).toBe(OnboardingRequestStatus.APPROVED);
      expect(approved.createdTenantId).toBe('tenant-1');
    });

    it('persists trialEndsAt when provided on approve', async () => {
      const trialEndsAt = new Date('2026-11-15T00:00:00.000Z');

      await service.approve(
        'req-1',
        staffPk,
        { trialEndsAt },
        {
          userId: staffPk,
          userEmail: 'staff@test.com',
        },
      );

      expect(tx.tenant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subscriptionStatus: 'TRIAL',
            trialEndsAt,
          }),
        }),
      );
    });
  });

  describe('updateMine', () => {
    it('updates details on a pending request owned by the caller', async () => {
      updateRequest.mockResolvedValue({
        ...requestRow,
        brandName: 'Acme Credit',
      });

      const updated = await service.updateMine(
        customerCaller,
        'req-1',
        { brandName: 'Acme Credit' },
        auditContext,
      );

      expect(updateRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { brandName: 'Acme Credit' },
        }),
      );
      expect(recordAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: BRAND_ONBOARDING_AUDIT_ACTIONS.UPDATED,
        }),
      );
      expect(updated.brandName).toBe('Acme Credit');
    });

    it('hides requests owned by another customer', async () => {
      findUniqueRequest.mockResolvedValue({
        ...requestRow,
        requestedBy: {
          ...requestRow.requestedBy,
          id: 99,
          userId: 'other-customer',
        },
      });

      await expect(
        service.updateMine(
          customerCaller,
          'req-1',
          { brandName: 'Acme Credit' },
          auditContext,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('cancelMine', () => {
    it('cancels a pending request owned by the caller', async () => {
      updateRequest.mockResolvedValue({
        ...requestRow,
        status: OnboardingRequestStatus.CANCELLED,
      });

      const cancelled = await service.cancelMine(
        customerCaller,
        'req-1',
        auditContext,
      );

      expect(updateRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: OnboardingRequestStatus.CANCELLED },
        }),
      );
      expect(recordAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: BRAND_ONBOARDING_AUDIT_ACTIONS.CANCELLED,
        }),
      );
      expect(cancelled.status).toBe(OnboardingRequestStatus.CANCELLED);
    });

    it('rejects cancel when the request is not pending', async () => {
      findUniqueRequest.mockResolvedValue({
        ...requestRow,
        status: OnboardingRequestStatus.APPROVED,
      });

      await expect(
        service.cancelMine(
          customerCaller,
          'req-1',
          auditContext,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
