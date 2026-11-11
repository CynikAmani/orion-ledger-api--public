import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { MeIdentityDocumentService } from './me-identity-document.service';
import { ME_AUDIT_ACTIONS } from '../constants/me-audit-actions.constant';

describe('MeIdentityDocumentService audit', () => {
  const upsert = jest.fn<(args?: unknown) => Promise<unknown>>();
  const emit = jest.fn();

  const auditContext = {
    userId: 1,
    userEmail: 'ada@old.test',
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
  };

  let service: MeIdentityDocumentService;

  beforeEach(() => {
    jest.clearAllMocks();
    upsert.mockResolvedValue({
      userId: 'user-1',
      identityDocumentUrl: 'doc',
      signatureUrl: null,
    });

    service = new MeIdentityDocumentService(
      { getByUserId: jest.fn(), upsert } as never,
      { emit } as never,
    );
  });

  it('emits identity upsert against the caller tenant so tenant drawers can list it', async () => {
    await service.upsertMine(
      1,
      { identityDocument: { originalname: 'id.png' } as Express.Multer.File },
      auditContext,
      'tenant-1',
    );

    expect(emit).toHaveBeenCalledWith({
      ...auditContext,
      tenantId: 'tenant-1',
      module: 'SELF',
      targetType: 'IdentityDocument',
      targetId: 'user-1',
      action: ME_AUDIT_ACTIONS.IDENTITY_DOCUMENT_UPSERTED,
      payload: {
        replacedIdentityDocument: true,
        replacedSignature: false,
      },
    });
  });
});
