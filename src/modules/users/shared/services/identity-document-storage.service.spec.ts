import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { IdentityDocumentStorageService } from './identity-document-storage.service';

describe('IdentityDocumentStorageService.getByUserId', () => {
  const findFirstUser = jest.fn<(args?: unknown) => Promise<unknown>>();
  const findFirstDocument = jest.fn<(args?: unknown) => Promise<unknown>>();
  const readPublicFileAsDataUrl =
    jest.fn<(path: string) => Promise<string | null>>();
  const bytesToDataUrl = jest.fn<(bytes?: Uint8Array | null) => string | null>();

  let service: IdentityDocumentStorageService;

  beforeEach(() => {
    jest.clearAllMocks();
    findFirstDocument.mockResolvedValue(null);
    readPublicFileAsDataUrl.mockResolvedValue(null);
    bytesToDataUrl.mockReturnValue(null);

    service = new IdentityDocumentStorageService(
      {
        user: { findFirst: findFirstUser },
        identityDocument: { findFirst: findFirstDocument },
      } as never,
      {
        readPublicFileAsDataUrl,
        bytesToDataUrl,
      } as never,
    );
  });

  it('excludes soft-deleted users by default', async () => {
    findFirstUser.mockResolvedValue(null);

    await expect(service.getByUserId(1)).rejects.toThrow(
      NotFoundException,
    );

    expect(findFirstUser).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1, deletedAt: null },
      }),
    );
  });

  it('includes soft-deleted users when requested and nulls missing files', async () => {
    findFirstUser.mockResolvedValue({
      id: 1,
      userId: 'staff-1',
      fullname: 'Soft Deleted',
      nationalId: 'nid-1',
    });

    await expect(
      service.getByUserId(1, { includeDeleted: true }),
    ).resolves.toEqual({
      userId: 'staff-1',
      fullname: 'Soft Deleted',
      nationalId: 'nid-1',
      identityDocumentDataUrl: null,
      signatureDataUrl: null,
    });

    expect(findFirstUser).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
      }),
    );
  });
});
