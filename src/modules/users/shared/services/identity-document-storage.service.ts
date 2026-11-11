import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../../core/database/prisma.service';
import { UPLOAD_DIRS } from '../../../../core/storage/constants/upload-dirs.constant';
import { ImageStorageService } from '../../../../core/storage/services/image-storage.service';
import { USER_IDENTITY_SELECT } from '../selects/user-identity.select';

export interface IdentityDocumentResponse {
  userId: string;
  fullname: string;
  /** Profile identity number (User.nationalId). Not the document scan. */
  nationalId: string;
  identityDocumentDataUrl: string | null;
  signatureDataUrl: string | null;
}

export interface IdentityDocumentVerificationStatus {
  hasNationalId: boolean;
  hasIdentityDocument: boolean;
  hasSignature: boolean;
}

const USER_SELECT = {
  ...USER_IDENTITY_SELECT,
  fullname: true,
  nationalId: true,
} as const;

/**
 * Domain facade over {@link ImageStorageService} for identity document + signature.
 */
@Injectable()
export class IdentityDocumentStorageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly imageStorage: ImageStorageService,
  ) {}

  async getByUserId(
    userId: number,
    options: { includeDeleted?: boolean } = {},
  ): Promise<IdentityDocumentResponse> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        ...(options.includeDeleted ? {} : { deletedAt: null }),
      },
      select: USER_SELECT,
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} was not found`);
    }

    const document = await this.prisma.identityDocument.findFirst({
      where: { userId: user.id },
      orderBy: { id: 'desc' },
      select: {
        identityDocumentImgName: true,
        signatureData: true,
      },
    });

    return {
      userId: user.userId,
      fullname: user.fullname,
      nationalId: user.nationalId,
      identityDocumentDataUrl: await this.toIdentityDocumentDataUrl(
        document?.identityDocumentImgName,
      ),
      signatureDataUrl: this.imageStorage.bytesToDataUrl(
        document?.signatureData,
      ),
    };
  }

  async getVerificationStatus(
    userId: number,
  ): Promise<IdentityDocumentVerificationStatus> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { nationalId: true },
    });

    if (!user) {
      return {
        hasNationalId: false,
        hasIdentityDocument: false,
        hasSignature: false,
      };
    }

    const document = await this.prisma.identityDocument.findFirst({
      where: { userId },
      orderBy: { id: 'desc' },
      select: {
        identityDocumentImgName: true,
        signatureData: true,
      },
    });

    return {
      hasNationalId: Boolean(user.nationalId?.trim()),
      hasIdentityDocument: Boolean(
        document?.identityDocumentImgName?.trim(),
      ),
      hasSignature: Boolean(document?.signatureData?.length),
    };
  }

  async upsert(
    userId: number,
    files: {
      identityDocument?: Express.Multer.File;
      signature?: Express.Multer.File;
    },
  ): Promise<IdentityDocumentResponse> {
    const identityDocument = this.presentFile(files.identityDocument);
    const signature = this.presentFile(files.signature);

    if (!identityDocument && !signature) {
      throw new BadRequestException(
        'At least one of identityDocument or signature is required',
      );
    }

    if (identityDocument) {
      this.imageStorage.assertUploadedImage(
        identityDocument,
        'identityDocument',
      );
    }

    if (signature) {
      this.imageStorage.assertUploadedImage(signature, 'signature');
    }

    await this.getByUserId(userId);

    const existing = await this.prisma.identityDocument.findFirst({
      where: { userId },
      orderBy: { id: 'desc' },
      select: { id: true, identityDocumentImgName: true },
    });

    let nextIdentityDocumentPath: string | undefined;

    if (identityDocument) {
      nextIdentityDocumentPath = await this.imageStorage.save(
        identityDocument,
        UPLOAD_DIRS.IDENTITY_DOCUMENTS,
      );
    }

    try {
      const signatureBytes = signature
        ? Uint8Array.from(signature.buffer)
        : undefined;

      if (existing) {
        await this.prisma.identityDocument.update({
          where: { id: existing.id },
          data: {
            ...(nextIdentityDocumentPath
              ? { identityDocumentImgName: nextIdentityDocumentPath }
              : {}),
            ...(signatureBytes ? { signatureData: signatureBytes } : {}),
          },
        });
      } else {
        await this.prisma.identityDocument.create({
          data: {
            userId,
            identityDocumentImgName: nextIdentityDocumentPath ?? null,
            signatureData: signatureBytes ?? null,
          },
        });
      }
    } catch (error) {
      if (nextIdentityDocumentPath) {
        await this.imageStorage.deleteIfExists(nextIdentityDocumentPath);
      }

      throw error;
    }

    if (nextIdentityDocumentPath && existing?.identityDocumentImgName) {
      await this.imageStorage.deleteIfExists(
        this.resolveIdentityDocumentRelativePath(
          existing.identityDocumentImgName,
        ),
      );
    }

    return this.getByUserId(userId);
  }

  private presentFile(
    file: Express.Multer.File | undefined,
  ): Express.Multer.File | undefined {
    if (!file || file.size <= 0) {
      return undefined;
    }

    return file;
  }

  private async toIdentityDocumentDataUrl(
    storedName: string | null | undefined,
  ): Promise<string | null> {
    if (!storedName?.trim()) {
      return null;
    }

    return this.imageStorage.readPublicFileAsDataUrl(
      this.resolveIdentityDocumentRelativePath(storedName.trim()),
    );
  }

  private resolveIdentityDocumentRelativePath(storedName: string): string {
    if (storedName.includes('/') || storedName.includes('\\')) {
      return storedName.replace(/\\/g, '/').replace(/^\/+/, '');
    }

    return `${UPLOAD_DIRS.IDENTITY_DOCUMENTS}/${storedName}`;
  }
}
