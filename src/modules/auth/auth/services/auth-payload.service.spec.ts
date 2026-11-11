import { UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AuthPayloadService } from './auth-payload.service';

describe('AuthPayloadService.buildLoginResponse', () => {
  const findUnique = jest.fn<(args?: unknown) => Promise<unknown>>();
  const getForRead = jest.fn<(args?: unknown) => Promise<unknown>>();
  const access = jest.fn<(args?: unknown) => Promise<unknown>>();
  const forLogin = jest.fn<(args?: unknown) => Promise<unknown>>();
  const isOnlineRepaymentsEnabled =
    jest.fn<() => Promise<boolean>>();
  const supportSignal = {
    audience: null,
    newTicketCount: 0,
    replyCount: 0,
  };
  const subscriptionAccess = {
    accessState: 'PAID',
    onTrial: false,
    trialEndsAt: null,
    daysRemaining: 12,
    accessStartsAt: '2026-09-01T00:00:00.000Z',
    accessEndsAt: '2026-10-01T00:00:00.000Z',
    plan: {
      id: 1,
      name: 'Monthly',
      billingCycle: 'MONTHLY',
      durationInDays: 30,
    },
    currentPlan: {
      id: 1,
      name: 'Monthly',
      billingCycle: 'MONTHLY',
      durationInDays: 30,
      price: '70000.00',
      isActive: true,
    },
    platformContact: {
      contactPhone: '+265111000000',
      whatsappPhone: '+265111000001',
      contactEmail: 'billing@orionloans-hub.africa',
    },
  };
  const eligibilitySnapshot = {
    uuid: 'tenant-1',
    slug: 'acme',
    tenantCode: 'ACME',
    status: 'NOT_READY',
    isEligible: false,
    criteria: {
      hasInterestRates: false,
      hasBrandProfile: true,
      hasTermsOfService: false,
      hasPrivacyPolicy: false,
    },
    missingRequirements: ['INTEREST_RATES', 'TERMS_OF_SERVICE', 'PRIVACY_POLICY'],
    subscription: null,
    computedAt: '2026-01-01T00:00:00.000Z',
  };

  let service: AuthPayloadService;

  beforeEach(() => {
    jest.clearAllMocks();
    getForRead.mockResolvedValue(eligibilitySnapshot);
    access.mockResolvedValue(subscriptionAccess);
    forLogin.mockResolvedValue(supportSignal);
    isOnlineRepaymentsEnabled.mockResolvedValue(true);
    service = new AuthPayloadService(
      {
        user: { findUnique },
      } as never,
      { getForRead } as never,
      { access } as never,
      { forLogin } as never,
      { isOnlineRepaymentsEnabled } as never,
    );
  });

  it('sets tenant to null for platform users', async () => {
    findUnique.mockResolvedValue({
      id: 1,
      userId: 'sudo@orionloans-hub.africa',
      fullname: 'Root',
      email: 'sudo@orionloans-hub.africa',
      phone: '+10000000000',
      nationalId: 'NAT-1',
      genderId: null,
      districtId: null,
      isBlocked: false,
      password: 'hash',
      tenantId: null,
      tenant: null,
      userRoles: [],
    });

    const result = await service.buildLoginResponse(1);

    expect(result.user.tenant).toBeNull();
    expect(result.user.onlineRepaymentsEnabled).toBe(true);
    expect(result.user.support).toEqual(supportSignal);
    expect(forLogin).toHaveBeenCalledWith({
      userId: 1,
      tenantId: null,
      permissions: [],
    });
    expect(access).not.toHaveBeenCalled();
    expect(isOnlineRepaymentsEnabled).toHaveBeenCalled();
  });

  it('includes membership theme for tenant staff', async () => {
    findUnique.mockResolvedValue({
      id: 2,
      userId: 'jane.doe',
      fullname: 'Jane Doe',
      email: 'jane@acme.com',
      phone: '+265999000111',
      nationalId: 'NAT-2',
      genderId: null,
      districtId: null,
      isBlocked: false,
      password: 'hash',
      tenantId: 'tenant-1',
      tenant: {
        tenantId: 'tenant-1',
        slug: 'acme',
        brandColor: '#1E3A8A',
        name: 'Acme Finance',
        logoUrl: 'public/brand-tenant/tenant-1/logo.png',
        brandProfile: {
          brandName: 'Acme',
          logoImgName: 'public/brand-tenant/tenant-1/logo.png',
        },
      },
      userRoles: [],
    });

    const result = await service.buildLoginResponse(2);

    expect(result.user.onlineRepaymentsEnabled).toBe(true);
    expect(result.user.tenant).toEqual({
      tenantId: 'tenant-1',
      slug: 'acme',
      brandColor: '#1E3A8A',
      brandName: 'Acme',
      logoImgName: 'public/brand-tenant/tenant-1/logo.png',
      logoUrl: '/public/brand-tenant/tenant-1/logo.png',
      loanApplicationEligibility: eligibilitySnapshot,
      subscription: subscriptionAccess,
    });
    expect(access).toHaveBeenCalledWith('tenant-1');
  });

  it('surfaces onlineRepaymentsEnabled false when the platform kill-switch is off', async () => {
    isOnlineRepaymentsEnabled.mockResolvedValue(false);
    findUnique.mockResolvedValue({
      id: 2,
      userId: 'jane.doe',
      fullname: 'Jane Doe',
      email: 'jane@acme.com',
      phone: '+265999000111',
      nationalId: 'NAT-2',
      genderId: null,
      districtId: null,
      isBlocked: false,
      password: 'hash',
      tenantId: 'tenant-1',
      tenant: {
        tenantId: 'tenant-1',
        slug: 'acme',
        brandColor: '#1E3A8A',
        name: 'Acme Finance',
        logoUrl: null,
        brandProfile: null,
      },
      userRoles: [],
    });

    const result = await service.buildLoginResponse(2);

    expect(result.user.onlineRepaymentsEnabled).toBe(false);
  });

  it('falls back to tenant name when brandName is unset', async () => {
    findUnique.mockResolvedValue({
      id: 2,
      userId: 'jane.doe',
      fullname: 'Jane Doe',
      email: 'jane@acme.com',
      phone: '+265999000111',
      nationalId: 'NAT-2',
      genderId: null,
      districtId: null,
      isBlocked: false,
      password: 'hash',
      tenantId: 'tenant-1',
      tenant: {
        tenantId: 'tenant-1',
        slug: 'acme-finance',
        brandColor: '#1E3A8A',
        name: 'Acme Finance',
        logoUrl: null,
        brandProfile: null,
      },
      userRoles: [],
    });

    const result = await service.buildLoginResponse(2);

    expect(result.user.tenant).toEqual({
      tenantId: 'tenant-1',
      slug: 'acme-finance',
      brandColor: '#1E3A8A',
      brandName: 'Acme Finance',
      logoImgName: null,
      logoUrl: null,
      loanApplicationEligibility: eligibilitySnapshot,
      subscription: subscriptionAccess,
    });
  });

  it('rejects a missing user', async () => {
    findUnique.mockResolvedValue(null);

    await expect(service.buildLoginResponse(999)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
