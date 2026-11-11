import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  APP_ERROR_CODES,
  appHttpException,
} from '../../../../common/exceptions/app-http.exception';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import type { AuditContext } from '../../../../core/audit/interfaces/audit-payload.interface';
import { AuditEmitterService } from '../../../../core/audit/services/audit-emitter.service';
import { BrevoEmailService } from '../../../../core/email/services/brevo-email.service';
import { PrismaService } from '../../../../core/database/prisma.service';
import {
  extractPermissionNames,
  extractRoleKeys,
  userRolesWithPermissionsInclude,
  type UserWithRolesAndPermissions,
} from '../../../auth/shared/utils/user-authorization.util';
import { hashPassword } from '../../../auth/shared/utils/hash-password.util';
import {
  isSystemRootIdentity,
  isSystemRootUserByRoleKeys,
} from '../../../auth/shared/utils/system-root-user.util';
import { sendPasswordChangedNotification } from '../../../auth/shared/utils/send-password-changed-notification.util';
import { UserAccountLifecycleValidator } from '../../shared/validators/user-account-lifecycle.validator';
import { UserAvatarService } from '../../shared/services/user-avatar.service';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { UpdateMfaPreferenceDto } from '../dto/update-mfa-preference.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { ME_AUDIT_ACTIONS } from '../constants/me-audit-actions.constant';
import { buildMfaPreferenceChangedEmail } from '../templates/mfa-preference-changed.email';
import { buildManagedUserProfileAuditPayload } from '../../managed-user/utils/managed-user-update-notification.util';

const meProfileSelect = {
  userId: true,
  fullname: true,
  email: true,
  phone: true,
  nationalId: true,
  avatarUrl: true,
  genderId: true,
  districtId: true,
  isBlocked: true,
  isMfaEnabled: true,
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
  userRoles: userRolesWithPermissionsInclude.userRoles,
} satisfies Prisma.UserSelect;

export type MeProfile = Omit<
  Prisma.UserGetPayload<{ select: typeof meProfileSelect }>,
  'deletedAt' | 'userRoles'
> & {
  roles: string[];
  permissions: string[];
};

export interface UpdateMfaPreferenceResponse {
  success: true;
  isMfaEnabled: boolean;
}

@Injectable()
export class MeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userAvatarService: UserAvatarService,
    private readonly emailService: BrevoEmailService,
    private readonly userAccountLifecycleValidator: UserAccountLifecycleValidator,
    private readonly auditEmitter: AuditEmitterService,
  ) {}

  async getProfile(id: number): Promise<MeProfile> {
    await this.userAccountLifecycleValidator.assertUserAccountIsNotDeletedById(
      id,
    );

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: meProfileSelect,
    });

    return this.toMeProfile(user!);
  }

  async updateProfile(
    id: number,
    updateProfileDto: UpdateProfileDto,
    auditContext: AuditContext,
    tenantId?: string | null,
  ): Promise<MeProfile> {
    const caller =
      await this.userAccountLifecycleValidator.assertUserAccountIsNotDeletedById(
        id,
      );

    const existing = await this.prisma.user.findUnique({
      where: { id },
      select: {
        fullname: true,
        email: true,
        phone: true,
        nationalId: true,
        genderId: true,
        districtId: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('User account not found');
    }

    const updateData = await this.buildProfileUpdateData(id, updateProfileDto);

    await this.prisma.user.update({
      where: { id },
      data: updateData,
      select: { userId: true },
    });

    const payload = buildManagedUserProfileAuditPayload(
      existing,
      updateProfileDto,
    );

    if (Object.keys(payload).length > 0) {
      this.emitSelfAudit(auditContext, tenantId, {
        action: ME_AUDIT_ACTIONS.PROFILE_UPDATED,
        targetType: 'User',
        targetId: caller.userId,
        payload,
      });
    }

    return this.getProfile(id);
  }

  private async buildProfileUpdateData(
    id: number,
    updateProfileDto: UpdateProfileDto,
  ): Promise<Prisma.UserUpdateInput> {
    const data: Prisma.UserUpdateInput = {};

    if (updateProfileDto.fullname !== undefined) {
      data.fullname = updateProfileDto.fullname;
    }

    if (updateProfileDto.email !== undefined) {
      const existingUser = await this.prisma.user.findFirst({
        where: {
          email: updateProfileDto.email,
          NOT: { id },
        },
        select: { userId: true },
      });

      if (existingUser) {
        throw new ConflictException('Email is already in use');
      }

      data.email = updateProfileDto.email;
    }

    if (updateProfileDto.phone !== undefined) {
      data.phone = updateProfileDto.phone;
    }

    if (updateProfileDto.nationalId !== undefined) {
      const existingUser = await this.prisma.user.findFirst({
        where: {
          nationalId: updateProfileDto.nationalId,
          NOT: { id },
        },
        select: { userId: true },
      });

      if (existingUser) {
        throw new ConflictException('National ID is already in use');
      }

      data.nationalId = updateProfileDto.nationalId;
    }

    if (updateProfileDto.genderId !== undefined) {
      const gender = await this.prisma.gender.findUnique({
        where: { genderId: updateProfileDto.genderId },
        select: { genderId: true },
      });

      if (!gender) {
        throw new BadRequestException('Invalid gender');
      }

      data.genders = { connect: { genderId: updateProfileDto.genderId } };
    }

    if (updateProfileDto.districtId !== undefined) {
      const district = await this.prisma.district.findUnique({
        where: { id: updateProfileDto.districtId },
        select: { id: true },
      });

      if (!district) {
        throw new BadRequestException('Invalid district');
      }

      data.districts = { connect: { id: updateProfileDto.districtId } };
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('At least one profile field must be provided');
    }

    return data;
  }

  async changePassword(
    id: number,
    changePasswordDto: ChangePasswordDto,
    auditContext: AuditContext,
    tenantId?: string | null,
  ): Promise<{ message: string }> {
    const caller =
      await this.userAccountLifecycleValidator.assertUserAccountIsNotDeletedById(
        id,
      );

    if (isSystemRootIdentity(caller.userId)) {
      throw new ForbiddenException(
        'The system master administrator password cannot be changed from the app',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        password: true,
        fullname: true,
        email: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User account not found');
    }

    if (user.password !== null) {
      if (!changePasswordDto.currentPassword) {
        throw new BadRequestException('Current password is required');
      }

      const passwordMatches = await bcrypt.compare(
        changePasswordDto.currentPassword,
        user.password,
      );

      if (!passwordMatches) {
        throw appHttpException(
          HttpStatus.BAD_REQUEST,
          'Current password is incorrect',
          APP_ERROR_CODES.INVALID_CURRENT_PASSWORD,
        );
      }

      if (changePasswordDto.currentPassword === changePasswordDto.newPassword) {
        throw new BadRequestException(
          'New password must be different from the current password',
        );
      }
    }

    const hashedPassword = await hashPassword(changePasswordDto.newPassword);

    await this.prisma.user.update({
      where: { id },
      data: {
        password: hashedPassword,
        sessionState: Prisma.DbNull,
      },
    });

    if (user.email) {
      sendPasswordChangedNotification(this.emailService, {
        email: user.email,
        fullname: user.fullname,
      });
    }

    this.emitSelfAudit(auditContext, tenantId, {
      action: ME_AUDIT_ACTIONS.PASSWORD_CHANGED,
      targetType: 'User',
      targetId: caller.userId,
      payload: {
        hadPassword: user.password !== null,
      },
    });

    return { message: 'Password updated successfully' };
  }

  async updateMfaPreference(
    id: number,
    dto: UpdateMfaPreferenceDto,
    auditContext: AuditContext,
    tenantId?: string | null,
  ): Promise<UpdateMfaPreferenceResponse> {
    const caller =
      await this.userAccountLifecycleValidator.assertUserAccountIsNotDeletedById(
        id,
      );

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        fullname: true,
        email: true,
        isMfaEnabled: true,
        userRoles: {
          select: {
            role: {
              select: { key: true },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User account not found');
    }

    const roleKeys = user.userRoles.map((userRole) => userRole.role.key);
    if (isSystemRootUserByRoleKeys(roleKeys)) {
      throw new ForbiddenException(
        'The system root account cannot use personal sign-in verification',
      );
    }

    if (dto.enabled && !user.email) {
      throw new BadRequestException(
        'An email address is required before enabling sign-in verification',
      );
    }

    if (user.isMfaEnabled === dto.enabled) {
      return {
        success: true,
        isMfaEnabled: user.isMfaEnabled,
      };
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { isMfaEnabled: dto.enabled },
      select: { isMfaEnabled: true },
    });

    if (user.email) {
      const emailContent = buildMfaPreferenceChangedEmail({
        fullname: user.fullname,
        enabled: dto.enabled,
      });

      void this.emailService.send({
        to: user.email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });
    }

    this.emitSelfAudit(auditContext, tenantId, {
      action: ME_AUDIT_ACTIONS.MFA_PREFERENCE_UPDATED,
      targetType: 'User',
      targetId: caller.userId,
      payload: {
        previousIsMfaEnabled: user.isMfaEnabled,
        isMfaEnabled: dto.enabled,
      },
    });

    return {
      success: true,
      isMfaEnabled: updatedUser.isMfaEnabled,
    };
  }

  async updateAvatar(
    id: number,
    file: Express.Multer.File,
    auditContext: AuditContext,
    tenantId?: string | null,
  ): Promise<MeProfile> {
    await this.userAvatarService.replaceAvatar(id, file);
    const profile = await this.getProfile(id);

    this.emitSelfAudit(auditContext, tenantId, {
      action: ME_AUDIT_ACTIONS.AVATAR_UPDATED,
      targetType: 'User',
      targetId: profile.userId,
      payload: {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      },
    });

    return profile;
  }

  async softDelete(
    id: number,
    auditContext: AuditContext,
    tenantId?: string | null,
  ): Promise<{ message: string }> {
    const caller =
      await this.userAccountLifecycleValidator.assertUserAccountIsNotDeletedById(
        id,
      );

    await this.prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        sessionState: Prisma.DbNull,
      },
    });

    this.emitSelfAudit(auditContext, tenantId, {
      action: ME_AUDIT_ACTIONS.ACCOUNT_SELF_DELETED,
      targetType: 'User',
      targetId: caller.userId,
    });

    return { message: 'Account deleted successfully' };
  }

  private emitSelfAudit(
    auditContext: AuditContext,
    tenantId: string | null | undefined,
    params: {
      action: string;
      targetType: string;
      targetId: string;
      payload?: Record<string, unknown>;
    },
  ): void {
    this.auditEmitter.emit({
      ...auditContext,
      tenantId: tenantId ?? undefined,
      module: 'SELF',
      ...params,
    });
  }

  private toMeProfile(
    user: Prisma.UserGetPayload<{ select: typeof meProfileSelect }>,
  ): MeProfile {
    const { deletedAt: _deletedAt, userRoles: _userRoles, ...profile } = user;

    const authorizationUser = user as unknown as UserWithRolesAndPermissions;

    return {
      ...profile,
      roles: extractRoleKeys(authorizationUser),
      permissions: extractPermissionNames(authorizationUser),
    };
  }
}
