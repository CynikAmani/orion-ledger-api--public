import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { SYSTEM_ROOT_USER_ID } from '../../../../auth/shared/constants/roles.constant';
import type { IdentityDocumentResponse } from '../../../shared/services/identity-document-storage.service';
import { ManagedUserIdentityDocumentsService } from './managed-user-identity-documents.service';

const IDENTITY_PAYLOAD: IdentityDocumentResponse = {
  userId: 'staff-1',
  fullname: 'Staff One',
  nationalId: 'nid-1',
  identityDocumentDataUrl: 'data:image/png;base64,doc',
  signatureDataUrl: null,
};

describe('ManagedUserIdentityDocumentsService', () => {
  const findFirstUser = jest.fn<(args?: unknown) => Promise<unknown>>();
  const findUniqueTenant = jest.fn<(args?: unknown) => Promise<unknown>>();
  const getByUserId =
    jest.fn<(userId: number, options?: { includeDeleted?: boolean }) => Promise<IdentityDocumentResponse>>();

  let service: ManagedUserIdentityDocumentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    findFirstUser.mockResolvedValue({ id: 10, userId: 'staff-1' });
    findUniqueTenant.mockResolvedValue({ tenantId: 'tenant-a' });
    getByUserId.mockResolvedValue(IDENTITY_PAYLOAD);

    service = new ManagedUserIdentityDocumentsService(
      {
        user: { findFirst: findFirstUser },
        tenant: { findUnique: findUniqueTenant },
      } as never,
      { getByUserId } as never,
    );
  });

  it('uses the same platform catalog as User Management findOne, including customers', async () => {
    getByUserId.mockResolvedValue({
      ...IDENTITY_PAYLOAD,
      userId: 'customer-1',
      identityDocumentDataUrl: null,
      signatureDataUrl: null,
    });

    await expect(
      service.getManagedUserIdentityDocument('customer-1', {
        kind: 'platform',
      }),
    ).resolves.toEqual({
      ...IDENTITY_PAYLOAD,
      userId: 'customer-1',
      identityDocumentDataUrl: null,
      signatureDataUrl: null,
    });

    expect(findFirstUser).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { tenantId: null },
            expect.objectContaining({
              userId: { not: SYSTEM_ROOT_USER_ID },
            }),
            { userId: 'customer-1' },
          ],
        },
      }),
    );
    expect(getByUserId).toHaveBeenCalledWith(10, {
      includeDeleted: true,
    });
  });

  it('returns 404 when platform findOne would also miss the user', async () => {
    findFirstUser.mockResolvedValue(null);

    await expect(
      service.getManagedUserIdentityDocument('tenant-member', {
        kind: 'platform',
      }),
    ).rejects.toThrow(NotFoundException);

    expect(getByUserId).not.toHaveBeenCalled();
  });

  it('scopes tenant catalog reads the same way as User Management findOne', async () => {
    await expect(
      service.getManagedUserIdentityDocument('member-1', {
        kind: 'tenant',
        tenantId: 'tenant-a',
      }),
    ).resolves.toEqual(IDENTITY_PAYLOAD);

    expect(findFirstUser).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { userId: 'member-1' },
            { tenantId: 'tenant-a' },
            expect.objectContaining({
              userId: { not: SYSTEM_ROOT_USER_ID },
            }),
          ],
        },
      }),
    );
    expect(findUniqueTenant).not.toHaveBeenCalled();
  });

  it('returns 404 when the target is outside the caller tenant catalog', async () => {
    findFirstUser.mockResolvedValue(null);

    await expect(
      service.getManagedUserIdentityDocument('platform-staff', {
        kind: 'tenant',
        tenantId: 'tenant-a',
      }),
    ).rejects.toThrow(NotFoundException);

    expect(getByUserId).not.toHaveBeenCalled();
  });

  it('requires the tenant to exist before loading a platform-inspected member', async () => {
    findUniqueTenant.mockResolvedValue(null);

    await expect(
      service.getManagedUserIdentityDocument('member-1', {
        kind: 'tenant-member',
        tenantId: 'missing-tenant',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(findFirstUser).not.toHaveBeenCalled();
    expect(getByUserId).not.toHaveBeenCalled();
  });

  it('returns 404 when the user is not a member of the inspected tenant', async () => {
    findFirstUser.mockResolvedValue(null);

    await expect(
      service.getManagedUserIdentityDocument('other-user', {
        kind: 'tenant-member',
        tenantId: 'tenant-a',
      }),
    ).rejects.toThrow(NotFoundException);

    expect(findFirstUser).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'other-user',
          tenantId: 'tenant-a',
        },
      }),
    );
    expect(getByUserId).not.toHaveBeenCalled();
  });
});
