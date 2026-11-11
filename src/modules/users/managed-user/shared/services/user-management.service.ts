import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { AuditEmitterService } from '../../../../../core/audit/services/audit-emitter.service';
import type { AuditContext } from '../../../../../core/audit/interfaces/audit-payload.interface';
import {
  buildAccountRecoveryUrl,
  buildAccountSetupUrl,
} from '../../../../../core/config/web-links.constants';
import { BrevoEmailService } from '../../../../../core/email/services/brevo-email.service';
import { NOTIFICATION_TYPES } from '../../../../../core/notifications/constants/notification-type.constant';
import { NotificationsService } from '../../../../../core/notifications/services/notifications.service';
import { PrismaService } from '../../../../../core/database/prisma.service';
import {
  SUPER_ADMIN_ROLE_KEY,
  SYSTEM_ROOT_USER_EMAIL,
  SYSTEM_ROOT_USER_ID,
} from '../../../../auth/shared/constants/roles.constant';
import { AccountAccessTokenService } from '../../../../auth/account-access/services/account-access-token.service';
import { hashPassword } from '../../../../auth/shared/utils/hash-password.util';
import { UserAvatarService } from '../../../shared/services/user-avatar.service';
import { USER_IDENTITY_SELECT } from '../../../shared/selects/user-identity.select';
import { UserAccountLifecycleValidator } from '../../../shared/validators/user-account-lifecycle.validator';
import { USER_MANAGEMENT_AUDIT_ACTIONS } from '../constants/user-management-audit-actions.constant';
import { AssignManagedUserRolesDto } from '../dto/assign-managed-user-roles.dto';
import { CreateManagedUserDto } from '../dto/create-managed-user.dto';
import {
  ListManagedUsersQueryDto,
  ManagedUserListStatus,
} from '../dto/list-managed-users-query.dto';
import { SetUserBlockStatusDto } from '../dto/set-user-block-status.dto';
import { UpdateManagedUserDto } from '../dto/update-managed-user.dto';
import { buildAccountDeletedEmail } from '../../templates/account-deleted.email';
import { buildAccountInvitationEmail } from '../../templates/account-invitation.email';
import { buildAccountRecoveryEmail } from '../../templates/account-recovery.email';
import { buildAccountStatusHoldEmail } from '../../templates/account-status-hold.email';
import { buildProfileModifiedByAdminEmail } from '../../templates/profile-modified-by-admin.email';
import { buildRoleAssignmentsUpdatedEmail } from '../../templates/role-assignments-updated.email';
import { buildAccountRestoredEmail } from '../../templates/account-restored.email';
import {
  resolveManagedUserUpdateNotifications,
  rolePublicIdsEqual,
  buildManagedUserProfileAuditPayload,
} from '../../utils/managed-user-update-notification.util';
import {
  excludeSuperAdminUserFilter,
  excludeUserManagementSubjects,
  managedUserDetailWhere,
  platformUserMembershipFilter,
} from '../utils/platform-user-scope.util';

export type UserManagementScope =
  { kind: 'platform' } | { kind: 'tenant'; tenantId: string };

const SUPER_ADMIN_PROTECTED_MESSAGE =
  'Super Admin accounts cannot be modified or deleted via user management endpoints';

const SELF_MANAGEMENT_MESSAGE =
  'You cannot manage your own account from user management. Use your profile instead.';

const managedUserListSelect = {
  ...USER_IDENTITY_SELECT,
  tenantId: true,
  fullname: true,
  email: true,
  phone: true,
  isBlocked: true,
  deletedAt: true,
  avatarUrl: true,
  userRoles: {
    select: {
      role: {
        select: {
          publicId: true,
          key: true,
          name: true,
        },
      },
    },
  },
} as const;

const managedUserDetailSelect = {
  userId: true,
  tenantId: true,
  fullname: true,
  email: true,
  phone: true,
  nationalId: true,
  avatarUrl: true,
  genderId: true,
  districtId: true,
  isBlocked: true,
  deletedAt: true,
  genders: {
    select: {
      genderId: true,
      gender: true,
    },
  },
  districts: {
    select: {
      id: true,
      districtName: true,
    },
  },
  userRoles: {
    select: {
      role: {
        select: {
          publicId: true,
          key: true,
          name: true,
          description: true,
        },
      },
    },
  },
} satisfies Prisma.UserSelect;

export type ManagedUserListItem = Omit<
  Prisma.UserGetPayload<{ select: typeof managedUserListSelect }>,
  'userRoles' | 'id'
> & {
  roles: Array<{
    publicId: string;
    key: string;
    name: string;
  }>;
};

export type ManagedUserDetail = Omit<
  Prisma.UserGetPayload<{ select: typeof managedUserDetailSelect }>,
  'userRoles'
> & {
  roles: string[];
  roleAssignments: Array<{
    publicId: string;
    key: string;
    name: string;
    description: string | null;
  }>;
};

export interface PaginatedManagedUsersResponse {
  data: ManagedUserListItem[];
  pagination: {
    page: number;
    hasNextPage: boolean;
  };
}

@Injectable()
export class UserManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: BrevoEmailService,
    private readonly notificationsService: NotificationsService,
    private readonly accountAccessTokenService: AccountAccessTokenService,
    private readonly userAvatarService: UserAvatarService,
    private readonly auditEmitter: AuditEmitterService,
    private readonly userAccountLifecycleValidator: UserAccountLifecycleValidator,
  ) {}

  async findAll(
    scope: UserManagementScope,
    query: ListManagedUsersQueryDto,
    callerUserId: number,
  ): Promise<PaginatedManagedUsersResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const users = await this.prisma.user.findMany({
      where: this.buildListWhereClause(scope, query, callerUserId),
      select: managedUserListSelect,
      orderBy: { fullname: 'asc' },
      skip,
      take: limit + 1,
    });

    const hasNextPage = users.length > limit;
    const pageUsers = (hasNextPage ? users.slice(0, limit) : users).filter(
      (user) =>
        !this.isSuperAdminRecord(user.userId, user.userRoles) &&
        user.id !== callerUserId,
    );

    return {
      data: pageUsers.map((user) => this.toListItem(user)),
      pagination: {
        page,
        hasNextPage,
      },
    };
  }

  async findOne(
    scope: UserManagementScope,
    userId: string,
    callerUserId?: number,
  ): Promise<ManagedUserDetail> {
    await this.assertCallerCannotSelfManage(callerUserId, userId);

    if (this.isReservedSuperAdminIdentity(userId)) {
      throw new NotFoundException('User not found');
    }

    const user = await this.prisma.user.findFirst({
      where: this.scopeUserWhere(scope, userId),
      select: managedUserDetailSelect,
    });

    if (!user || this.isSuperAdminRecord(user.userId, user.userRoles)) {
      throw new NotFoundException('User not found');
    }

    return this.toDetail(user);
  }

  async create(
    scope: UserManagementScope,
    createDto: CreateManagedUserDto,
    auditContext: AuditContext,
    frontendOrigin: string,
  ): Promise<ManagedUserDetail> {
    this.assertCreateDoesNotTargetSuperAdmin(createDto);

    const existingUser = await this.prisma.user.findUnique({
      where: { userId: createDto.userId },
      select: { userId: true },
    });

    if (existingUser) {
      throw new ConflictException('Username is already in use');
    }

    if (createDto.email) {
      const existingEmail = await this.prisma.user.findFirst({
        where: { email: createDto.email },
        select: { userId: true },
      });

      if (existingEmail) {
        throw new ConflictException('Email is already in use');
      }
    }

    const existingNationalId = await this.prisma.user.findFirst({
      where: { nationalId: createDto.nationalId },
      select: { userId: true },
    });

    if (existingNationalId) {
      throw new ConflictException('National ID is already in use');
    }

    const roles = await this.validateRolePublicIds(
      scope,
      createDto.rolePublicIds,
    );
    await this.validateOptionalForeignKeys(
      createDto.genderId,
      createDto.districtId,
    );

    const lockedPassword = await this.generateLockedPassword();
    const tenantId = this.scopeTenantId(scope);

    await this.prisma.user.create({
      data: {
        userId: createDto.userId,
        email: createDto.email,
        fullname: createDto.fullname,
        phone: createDto.phone,
        genderId: createDto.genderId,
        districtId: createDto.districtId,
        password: lockedPassword,
        nationalId: createDto.nationalId,
        tenantId,
        userRoles: {
          create: roles.map((role) => ({
            roleId: role.roleId,
            tenantId,
          })),
        },
      },
      select: { userId: true },
    });

    if (createDto.email) {
      const setupToken = await this.accountAccessTokenService.sign(
        createDto.userId,
      );
      const setupUrl = buildAccountSetupUrl(
        frontendOrigin,
        createDto.userId,
        setupToken,
      );
      const emailContent = buildAccountInvitationEmail({
        fullname: createDto.fullname,
        setupUrl,
      });

      void this.emailService.send({
        to: createDto.email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });
    }

    this.emitAudit(scope, auditContext, {
      action: USER_MANAGEMENT_AUDIT_ACTIONS.CREATED,
      targetId: createDto.userId,
      payload: {
        userId: createDto.userId,
        email: createDto.email,
        rolePublicIds: createDto.rolePublicIds,
      },
    });

    return this.findOne(scope, createDto.userId, auditContext.userId);
  }

  async triggerRecovery(
    scope: UserManagementScope,
    userId: string,
    auditContext: AuditContext,
    frontendOrigin: string,
  ): Promise<{ message: string }> {
    await this.assertMutableInScope(scope, userId, auditContext.userId);

    const user =
      await this.userAccountLifecycleValidator.assertUserAccountIsNotDeleted(
        userId,
      );
    const lockedPassword = await this.generateLockedPassword();

    await this.prisma.user.update({
      where: { userId },
      data: {
        password: lockedPassword,
        sessionState: Prisma.DbNull,
        passwordResetPin: null,
        passwordResetExpires: null,
      },
    });

    if (user.email) {
      const setupToken = await this.accountAccessTokenService.sign(userId);
      const recoveryUrl = buildAccountRecoveryUrl(
        frontendOrigin,
        userId,
        setupToken,
      );
      const emailContent = buildAccountRecoveryEmail({
        fullname: user.fullname,
        recoveryUrl,
      });

      void this.emailService.send({
        to: user.email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });
    }

    this.emitAudit(scope, auditContext, {
      action: USER_MANAGEMENT_AUDIT_ACTIONS.RECOVERY,
      targetId: userId,
    });

    return { message: 'Account recovery initiated successfully' };
  }

  async update(
    scope: UserManagementScope,
    userId: string,
    updateDto: UpdateManagedUserDto,
    auditContext: AuditContext,
  ): Promise<ManagedUserDetail> {
    const target = await this.assertMutableInScope(
      scope,
      userId,
      auditContext.userId,
    );
    await this.userAccountLifecycleValidator.assertUserAccountIsNotDeleted(
      userId,
    );

    const existingUser = await this.prisma.user.findUnique({
      where: { userId },
      select: {
        fullname: true,
        email: true,
        phone: true,
        nationalId: true,
        genderId: true,
        districtId: true,
      },
    });

    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    const notificationPlan = resolveManagedUserUpdateNotifications(
      existingUser,
      updateDto,
    );

    const updateData = await this.buildManagedUserUpdateData(userId, updateDto);

    await this.prisma.user.update({
      where: { userId },
      data: updateData,
      select: { userId: true },
    });

    const user = await this.findOne(scope, userId, auditContext.userId);

    if (user.email && notificationPlan.profileChanged) {
      const emailContent = buildProfileModifiedByAdminEmail({
        fullname: user.fullname,
      });

      void this.emailService.send({
        to: user.email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });

      this.notificationsService.push({
        targetUser: target.id,
        type: NOTIFICATION_TYPES.INFO,
        content:
          'An administrator updated your profile details. Contact support if you did not authorize this change.',
      });
    }

    this.emitAudit(scope, auditContext, {
      action: USER_MANAGEMENT_AUDIT_ACTIONS.UPDATED,
      targetId: userId,
      payload: buildManagedUserProfileAuditPayload(existingUser, updateDto),
    });

    return user;
  }

  async updateRoles(
    scope: UserManagementScope,
    userId: string,
    assignRolesDto: AssignManagedUserRolesDto,
    auditContext: AuditContext,
  ): Promise<ManagedUserDetail> {
    const target = await this.assertMutableInScope(
      scope,
      userId,
      auditContext.userId,
    );
    await this.userAccountLifecycleValidator.assertUserAccountIsNotDeleted(
      userId,
    );

    const existingUser = await this.prisma.user.findUnique({
      where: { userId },
      select: {
        email: true,
        fullname: true,
        userRoles: {
          select: {
            role: { select: { publicId: true } },
          },
        },
      },
    });

    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    const currentPublicIds = existingUser.userRoles.map(
      (assignment) => assignment.role.publicId,
    );
    const roles = await this.validateRolePublicIds(
      scope,
      assignRolesDto.rolePublicIds,
    );

    if (rolePublicIdsEqual(currentPublicIds, assignRolesDto.rolePublicIds)) {
      return this.findOne(scope, userId, auditContext.userId);
    }

    const tenantId = this.scopeTenantId(scope);

    await this.prisma.user.update({
      where: { userId },
      data: {
        userRoles: {
          deleteMany: { userId: target.id },
          create: roles.map((role) => ({
            roleId: role.roleId,
            tenantId,
          })),
        },
      },
      select: { userId: true },
    });

    const user = await this.findOne(scope, userId, auditContext.userId);

    if (user.email) {
      const roleNames = user.roleAssignments.map(
        (assignment) => assignment.name,
      );
      const emailContent = buildRoleAssignmentsUpdatedEmail({
        fullname: user.fullname,
        roleNames,
      });

      void this.emailService.send({
        to: user.email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });

      this.notificationsService.push({
        targetUser: target.id,
        type: NOTIFICATION_TYPES.WARNING,
        content:
          'Your role assignments were updated by an administrator. Review your access and contact support if unexpected.',
      });
    }

    this.emitAudit(scope, auditContext, {
      action: USER_MANAGEMENT_AUDIT_ACTIONS.ROLES_ASSIGNED,
      targetId: userId,
      payload: {
        previousRolePublicIds: currentPublicIds,
        nextRolePublicIds: assignRolesDto.rolePublicIds,
      },
    });

    return user;
  }

  async updateAvatar(
    scope: UserManagementScope,
    userId: string,
    file: Express.Multer.File,
    auditContext: AuditContext,
  ): Promise<ManagedUserDetail> {
    const target = await this.assertMutableInScope(
      scope,
      userId,
      auditContext.userId,
    );
    await this.userAvatarService.replaceAvatar(target.id, file);

    this.emitAudit(scope, auditContext, {
      action: USER_MANAGEMENT_AUDIT_ACTIONS.AVATAR_UPDATED,
      targetId: userId,
    });

    return this.findOne(scope, userId, auditContext.userId);
  }

  async setBlockStatus(
    scope: UserManagementScope,
    userId: string,
    blockDto: SetUserBlockStatusDto,
    auditContext: AuditContext,
  ): Promise<ManagedUserDetail> {
    await this.assertMutableInScope(scope, userId, auditContext.userId);

    const existingUser =
      await this.userAccountLifecycleValidator.assertUserAccountIsNotDeleted(
        userId,
      );

    await this.prisma.user.update({
      where: { userId },
      data: { isBlocked: blockDto.isBlocked },
      select: { userId: true },
    });

    const user = await this.findOne(scope, userId, auditContext.userId);

    if (user.email) {
      const emailContent = buildAccountStatusHoldEmail({
        fullname: user.fullname,
        isBlocked: blockDto.isBlocked,
      });

      void this.emailService.send({
        to: user.email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });
    }

    this.notificationsService.push({
      targetUser: existingUser.id,
      type: blockDto.isBlocked
        ? NOTIFICATION_TYPES.ALERT
        : NOTIFICATION_TYPES.INFO,
      content: blockDto.isBlocked
        ? 'Your account business activity hold has been applied by an administrator.'
        : 'Your account business activity hold has been lifted by an administrator.',
    });

    this.emitAudit(scope, auditContext, {
      action: USER_MANAGEMENT_AUDIT_ACTIONS.BLOCKED,
      targetId: userId,
      payload: {
        previousValue: existingUser.isBlocked,
        nextValue: blockDto.isBlocked,
      },
    });

    return user;
  }

  async terminateSessions(
    scope: UserManagementScope,
    userId: string,
    auditContext: AuditContext,
  ): Promise<{ message: string }> {
    await this.assertMutableInScope(scope, userId, auditContext.userId);
    await this.userAccountLifecycleValidator.assertUserAccountIsNotDeleted(
      userId,
    );

    await this.prisma.user.update({
      where: { userId },
      data: { sessionState: Prisma.DbNull },
    });

    this.emitAudit(scope, auditContext, {
      action: USER_MANAGEMENT_AUDIT_ACTIONS.SESSIONS_TERMINATED,
      targetId: userId,
    });

    return { message: 'All active sessions terminated successfully' };
  }

  async softDelete(
    scope: UserManagementScope,
    userId: string,
    auditContext: AuditContext,
  ): Promise<{ message: string }> {
    await this.assertMutableInScope(scope, userId, auditContext.userId);

    const user =
      await this.userAccountLifecycleValidator.assertUserAccountIsNotDeleted(
        userId,
      );

    await this.prisma.user.update({
      where: { userId },
      data: {
        deletedAt: new Date(),
        sessionState: Prisma.DbNull,
      },
    });

    if (user.email) {
      const emailContent = buildAccountDeletedEmail({
        fullname: user.fullname,
      });

      void this.emailService.send({
        to: user.email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });
    }

    this.notificationsService.push({
      targetUser: user.id,
      type: NOTIFICATION_TYPES.ALERT,
      content:
        'Your account has been deleted by an administrator. Contact support immediately if this was unexpected.',
    });

    this.emitAudit(scope, auditContext, {
      action: USER_MANAGEMENT_AUDIT_ACTIONS.DELETED,
      targetId: userId,
    });

    return { message: 'User deleted successfully' };
  }

  async undeleteUserAccount(
    scope: UserManagementScope,
    userId: string,
    auditContext: AuditContext,
  ): Promise<ManagedUserDetail> {
    await this.assertMutableInScope(scope, userId, auditContext.userId);

    const user =
      await this.userAccountLifecycleValidator.getUserIfExists(userId);

    if (user.deletedAt === null) {
      throw new BadRequestException('Account is not deleted');
    }

    await this.prisma.user.update({
      where: { userId },
      data: { deletedAt: null },
      select: { userId: true },
    });

    const restoredUser = await this.findOne(scope, userId, auditContext.userId);

    if (restoredUser.email) {
      const emailContent = buildAccountRestoredEmail({
        fullname: restoredUser.fullname,
      });

      void this.emailService.send({
        to: restoredUser.email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });
    }

    this.notificationsService.push({
      targetUser: user.id,
      type: NOTIFICATION_TYPES.INFO,
      content:
        'Your account access has been officially restored by an administrator.',
    });

    this.emitAudit(scope, auditContext, {
      action: USER_MANAGEMENT_AUDIT_ACTIONS.RESTORED,
      targetId: userId,
    });

    return restoredUser;
  }

  private scopeTenantId(scope: UserManagementScope): string | null {
    return scope.kind === 'tenant' ? scope.tenantId : null;
  }

  private membershipWhere(
    scope: UserManagementScope,
    callerUserId: number,
  ): Prisma.UserWhereInput {
    const excludeCaller: Prisma.UserWhereInput = { id: { not: callerUserId } };

    if (scope.kind === 'platform') {
      return {
        AND: [
          platformUserMembershipFilter,
          excludeUserManagementSubjects(),
          excludeCaller,
        ],
      };
    }

    return {
      AND: [
        { tenantId: scope.tenantId },
        excludeSuperAdminUserFilter,
        excludeCaller,
      ],
    };
  }

  private scopeUserWhere(
    scope: UserManagementScope,
    userId: string,
  ): Prisma.UserWhereInput {
    return managedUserDetailWhere(scope, userId);
  }

  private async assertMutableInScope(
    scope: UserManagementScope,
    userId: string,
    callerUserId?: number,
  ): Promise<{ id: number; userId: string }> {
    await this.assertCallerCannotSelfManage(callerUserId, userId);
    await this.assertTargetUserIsNotSuperAdmin(userId);

    const existing = await this.prisma.user.findFirst({
      where: this.scopeUserWhere(scope, userId),
      select: { id: true, userId: true },
    });

    if (!existing) {
      throw new NotFoundException('User not found');
    }

    return existing;
  }

  private buildListWhereClause(
    scope: UserManagementScope,
    query: ListManagedUsersQueryDto,
    callerUserId: number,
  ): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = {
      ...this.membershipWhere(scope, callerUserId),
    };

    if (query.status === ManagedUserListStatus.ACTIVE) {
      where.deletedAt = null;
      where.isBlocked = false;
    } else if (query.status === ManagedUserListStatus.BLOCKED) {
      where.deletedAt = null;
      where.isBlocked = true;
    } else if (query.status === ManagedUserListStatus.DELETED) {
      where.deletedAt = { not: null };
    }

    if (query.search) {
      const searchTerm = query.search.trim();
      where.OR = [
        { userId: { contains: searchTerm, mode: 'insensitive' } },
        { fullname: { contains: searchTerm, mode: 'insensitive' } },
        { email: { contains: searchTerm, mode: 'insensitive' } },
        { phone: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    if (query.rolePublicIds?.length) {
      where.userRoles = {
        some: {
          role: {
            publicId: { in: query.rolePublicIds },
            tenantId: this.scopeTenantId(scope),
          },
        },
      };
    }

    return where;
  }

  private async buildManagedUserUpdateData(
    userId: string,
    updateDto: UpdateManagedUserDto,
  ): Promise<Prisma.UserUpdateInput> {
    const data: Prisma.UserUpdateInput = {};

    if (updateDto.fullname !== undefined) {
      data.fullname = updateDto.fullname;
    }

    if (updateDto.email !== undefined) {
      const existingUser = await this.prisma.user.findFirst({
        where: {
          email: updateDto.email,
          NOT: { userId },
        },
        select: { userId: true },
      });

      if (existingUser) {
        throw new ConflictException('Email is already in use');
      }

      data.email = updateDto.email;
    }

    if (updateDto.phone !== undefined) {
      data.phone = updateDto.phone;
    }

    if (updateDto.nationalId !== undefined) {
      const existingUser = await this.prisma.user.findFirst({
        where: {
          nationalId: updateDto.nationalId,
          NOT: { userId },
        },
        select: { userId: true },
      });

      if (existingUser) {
        throw new ConflictException('National ID is already in use');
      }

      data.nationalId = updateDto.nationalId;
    }

    if (updateDto.genderId !== undefined) {
      const gender = await this.prisma.gender.findUnique({
        where: { genderId: updateDto.genderId },
        select: { genderId: true },
      });

      if (!gender) {
        throw new BadRequestException('Invalid gender');
      }

      data.genders = { connect: { genderId: updateDto.genderId } };
    }

    if (updateDto.districtId !== undefined) {
      const district = await this.prisma.district.findUnique({
        where: { id: updateDto.districtId },
        select: { id: true },
      });

      if (!district) {
        throw new BadRequestException('Invalid district');
      }

      data.districts = { connect: { id: updateDto.districtId } };
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('At least one field must be provided');
    }

    return data;
  }

  private assertCreateDoesNotTargetSuperAdmin(
    createDto: CreateManagedUserDto,
  ): void {
    if (
      this.isReservedSuperAdminIdentity(createDto.userId) ||
      createDto.email?.toLowerCase() === SYSTEM_ROOT_USER_EMAIL.toLowerCase()
    ) {
      throw new ForbiddenException(SUPER_ADMIN_PROTECTED_MESSAGE);
    }
  }

  private isReservedSuperAdminIdentity(userId: string): boolean {
    return userId.toLowerCase() === SYSTEM_ROOT_USER_ID.toLowerCase();
  }

  private async assertCallerCannotSelfManage(
    callerUserId: number | undefined,
    targetUserId: string,
  ): Promise<void> {
    if (callerUserId === undefined) {
      return;
    }

    const target = await this.prisma.user.findUnique({
      where: { userId: targetUserId },
      select: { id: true },
    });

    if (target?.id === callerUserId) {
      throw new ForbiddenException(SELF_MANAGEMENT_MESSAGE);
    }
  }

  private isSuperAdminRecord(
    userId: string,
    userRoles: Array<{ role: { key: string } }>,
  ): boolean {
    return (
      this.isReservedSuperAdminIdentity(userId) ||
      userRoles.some((userRole) => userRole.role.key === SUPER_ADMIN_ROLE_KEY)
    );
  }

  private async assertTargetUserIsNotSuperAdmin(userId: string): Promise<void> {
    if (this.isReservedSuperAdminIdentity(userId)) {
      throw new ForbiddenException(SUPER_ADMIN_PROTECTED_MESSAGE);
    }

    const superAdminAssignment = await this.prisma.userRole.findFirst({
      where: {
        user: { userId },
        role: { key: SUPER_ADMIN_ROLE_KEY },
      },
      select: { userId: true },
    });

    if (superAdminAssignment) {
      throw new ForbiddenException(SUPER_ADMIN_PROTECTED_MESSAGE);
    }
  }

  private async validateRolePublicIds(
    scope: UserManagementScope,
    rolePublicIds: string[],
  ): Promise<Array<{ roleId: number; publicId: string }>> {
    const uniquePublicIds = [...new Set(rolePublicIds)];
    const expectedTenantId = this.scopeTenantId(scope);

    const roles = await this.prisma.role.findMany({
      where: { publicId: { in: uniquePublicIds } },
      select: { roleId: true, publicId: true, key: true, tenantId: true },
    });

    if (roles.length !== uniquePublicIds.length) {
      throw new BadRequestException('One or more role public IDs are invalid');
    }

    if (roles.some((role) => role.key === SUPER_ADMIN_ROLE_KEY)) {
      throw new ForbiddenException(
        'The Super Admin role cannot be assigned through user management',
      );
    }

    if (roles.some((role) => role.tenantId !== expectedTenantId)) {
      throw new BadRequestException(
        'One or more roles are outside this User Management scope',
      );
    }

    return roles;
  }

  private async validateOptionalForeignKeys(
    genderId?: number,
    districtId?: number,
  ): Promise<void> {
    if (genderId !== undefined) {
      const gender = await this.prisma.gender.findUnique({
        where: { genderId },
        select: { genderId: true },
      });

      if (!gender) {
        throw new BadRequestException('Invalid gender');
      }
    }

    if (districtId !== undefined) {
      const district = await this.prisma.district.findUnique({
        where: { id: districtId },
        select: { id: true },
      });

      if (!district) {
        throw new BadRequestException('Invalid district');
      }
    }
  }

  private async generateLockedPassword(): Promise<string> {
    const randomSecret = randomBytes(48).toString('base64url');
    return hashPassword(randomSecret);
  }

  private toListItem(
    user: Prisma.UserGetPayload<{ select: typeof managedUserListSelect }>,
  ): ManagedUserListItem {
    const { userRoles, id: _id, ...profile } = user;

    return {
      ...profile,
      roles: userRoles.map((assignment) => ({
        publicId: assignment.role.publicId,
        key: assignment.role.key,
        name: assignment.role.name,
      })),
    };
  }

  private toDetail(
    user: Prisma.UserGetPayload<{ select: typeof managedUserDetailSelect }>,
  ): ManagedUserDetail {
    const { userRoles, ...profile } = user;

    return {
      ...profile,
      roles: userRoles.map((assignment) => assignment.role.key),
      roleAssignments: userRoles.map((assignment) => ({
        publicId: assignment.role.publicId,
        key: assignment.role.key,
        name: assignment.role.name,
        description: assignment.role.description,
      })),
    };
  }

  private emitAudit(
    scope: UserManagementScope,
    auditContext: AuditContext,
    params: {
      action: string;
      targetId: string;
      payload?: Record<string, unknown>;
    },
  ): void {
    this.auditEmitter.emit({
      ...auditContext,
      tenantId: scope.kind === 'tenant' ? scope.tenantId : null,
      module: scope.kind === 'tenant' ? 'TENANT' : 'PLATFORM',
      targetType: 'User',
      ...params,
    });
  }
}
