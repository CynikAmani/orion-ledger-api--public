import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../../core/database/prisma.service';
import {
  IdentityDocumentStorageService,
  type IdentityDocumentResponse,
} from '../../../shared/services/identity-document-storage.service';
import { managedUserDetailWhere } from '../utils/platform-user-scope.util';

export type ManagedUserIdentityCatalog =
  | { kind: 'platform' }
  | { kind: 'tenant'; tenantId: string }
  | { kind: 'tenant-member'; tenantId: string };

/**
 * Read-only identity document + signature for managed-user catalogs.
 * Does not broaden customer-ops GET /users/:userId/identity-document.
 */
@Injectable()
export class ManagedUserIdentityDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identityDocumentStorage: IdentityDocumentStorageService,
  ) {}

  async getManagedUserIdentityDocument(
    userId: string,
    catalog: ManagedUserIdentityCatalog,
  ): Promise<IdentityDocumentResponse> {
    const user = await this.assertUserInCatalog(userId, catalog);

    return this.identityDocumentStorage.getByUserId(user.id, {
      includeDeleted: true,
    });
  }

  private async assertUserInCatalog(
    userId: string,
    catalog: ManagedUserIdentityCatalog,
  ): Promise<{ id: number; userId: string }> {
    if (catalog.kind === 'tenant-member') {
      await this.assertTenantExists(catalog.tenantId);
    }

    const user = await this.prisma.user.findFirst({
      where: this.catalogWhere(userId, catalog),
      select: { id: true, userId: true },
    });

    if (!user) {
      throw new NotFoundException(
        catalog.kind === 'tenant-member' ? 'Member not found' : 'User not found',
      );
    }

    return user;
  }

  private catalogWhere(
    userId: string,
    catalog: ManagedUserIdentityCatalog,
  ): Prisma.UserWhereInput {
    if (catalog.kind === 'tenant-member') {
      return {
        userId,
        tenantId: catalog.tenantId,
      };
    }

    return managedUserDetailWhere(catalog, userId);
  }

  private async assertTenantExists(tenantId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { tenantId },
      select: { tenantId: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
  }
}
