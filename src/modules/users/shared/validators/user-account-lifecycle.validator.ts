import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../core/database/prisma.service';
import { SYSTEM_ROOT_USER_ID } from '../../../auth/shared/constants/roles.constant';
import { USER_IDENTITY_SELECT } from '../selects/user-identity.select';

export const lifecycleUserSelect = {
  ...USER_IDENTITY_SELECT,
  fullname: true,
  email: true,
  isBlocked: true,
  deletedAt: true,
  avatarUrl: true,
  credentialsVersion: true,
} as const;

export type LifecycleUserRecord = Prisma.UserGetPayload<{
  select: typeof lifecycleUserSelect;
}>;

@Injectable()
export class UserAccountLifecycleValidator {
  constructor(private readonly prisma: PrismaService) {}

  async getUserIfExists(userId: string): Promise<LifecycleUserRecord> {
    const user = await this.prisma.user.findUnique({
      where: { userId },
      select: lifecycleUserSelect,
    });

    if (!user) {
      throw new NotFoundException(
        'User account does not exist in the system',
      );
    }

    return user;
  }

  async getUserByIdIfExists(id: number): Promise<LifecycleUserRecord> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: lifecycleUserSelect,
    });

    if (!user) {
      throw new NotFoundException(
        'User account does not exist in the system',
      );
    }

    return user;
  }

  async assertUserAccountIsNotDeleted(
    userId: string,
  ): Promise<LifecycleUserRecord> {
    return this.assertNotDeleted(await this.getUserIfExists(userId));
  }

  async assertUserAccountIsNotDeletedById(
    id: number,
  ): Promise<LifecycleUserRecord> {
    return this.assertNotDeleted(await this.getUserByIdIfExists(id));
  }

  async assertUserCanAuthenticate(id: number): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        userId: true,
        tenantId: true,
        userRoles: { select: { roleId: true } },
      },
    });

    if (!user) {
      throw new NotFoundException(
        'User account does not exist in the system',
      );
    }

    this.assertTenantMemberHasAssignedRoles(user);
  }

  assertTenantMemberHasAssignedRoles(user: {
    userId: string;
    tenantId: string | null;
    userRoles: Array<unknown>;
  }): void {
    if (user.userId === SYSTEM_ROOT_USER_ID) {
      return;
    }

    if (user.tenantId && user.userRoles.length === 0) {
      throw new ForbiddenException(
        'Your account is registered with an organization but has no assigned role. Contact your organization administrator to request access.',
      );
    }
  }

  private assertNotDeleted(user: LifecycleUserRecord): LifecycleUserRecord {
    if (user.deletedAt !== null) {
      throw new ForbiddenException(
        'Operation denied: User account has been soft-deleted.',
      );
    }

    return user;
  }
}
