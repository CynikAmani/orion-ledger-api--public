import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalRequestStatus,
  PaymentStatus,
  Prisma,
  SubscriptionStatus,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import type { AuditContext } from '../../../../core/audit/interfaces/audit-payload.interface';
import { AuditService } from '../../../../core/audit/services/audit.service';
import { buildAccountSetupUrl } from '../../../../core/config/web-links.constants';
import { PrismaService } from '../../../../core/database/prisma.service';
import { BrevoEmailService } from '../../../../core/email/services/brevo-email.service';
import { AccountAccessTokenService } from '../../../auth/account-access/services/account-access-token.service';
import {
  SUPER_ADMIN_ROLE_KEY,
  SYSTEM_ROOT_USER_EMAIL,
  SYSTEM_ROOT_USER_ID,
} from '../../../auth/shared/constants/roles.constant';
import { hashPassword } from '../../../auth/shared/utils/hash-password.util';
import { buildAccountInvitationEmail } from '../../../users/managed-user/templates/account-invitation.email';
import {
  CUSTOMER_OPS_PERMISSION_PREFIX,
  GLOBAL_INBOX_PERMISSIONS,
  SELF_PERMISSION_PREFIX,
  TENANT_PERMISSION_PREFIX,
} from '../../../roles/shared/utils/role-permission-scope.util';
import { TENANT_ONBOARDING_AUDIT_ACTIONS } from '../constants/tenant-onboarding-audit-actions.constant';
import { TENANT_ADMINISTRATOR_ROLE } from '../constants/tenant-onboarding.constant';
import {
  TENANT_LOAN_APPLICATION_ELIGIBILITY_SNAPSHOT_SELECT,
  toTenantLoanApplicationEligibilityResponse,
  type TenantLoanApplicationEligibilityResponse,
} from '../../shared/utils/tenant-loan-application-eligibility.mapper';
import { platformUserWhere } from '../../../users/managed-user/shared/utils/platform-user-scope.util';
import { ManagedUserListStatus } from '../../../users/managed-user/shared/dto/list-managed-users-query.dto';
import { AssignPlatformTenantMemberDto } from '../dto/assign-platform-tenant-member.dto';
import { ListPlatformTenantMembersQueryDto } from '../dto/list-platform-tenant-members-query.dto';
import { ListPlatformTenantsQueryDto } from '../dto/list-platform-tenants-query.dto';
import { OnboardTenantDto } from '../dto/onboard-tenant.dto';
import { TenantLoanApplicationEligibilityService } from '../../shared/services/tenant-loan-application-eligibility.service';
import { resolveTenantLogoUrl } from '../../shared/utils/resolve-tenant-logo-url.util';

const TENANT_ONBOARDING_SELECT = {
  tenantId: true,
  tenantCode: true,
  slug: true,
  name: true,
  logoUrl: true,
  brandColor: true,
  isActive: true,
  isDemo: true,
  subscriptionStatus: true,
  paymentStatus: true,
  trialEndsAt: true,
  createdAt: true,
  brandProfile: {
    select: {
      logoImgName: true,
    },
  },
} as const;

const TENANT_INSPECTION_SELECT = {
  ...TENANT_ONBOARDING_SELECT,
  updatedAt: true,
  loanApplicationEligibility: {
    select: TENANT_LOAN_APPLICATION_ELIGIBILITY_SNAPSHOT_SELECT,
  },
} as const;

const ADMINISTRATOR_ROLE_SELECT = {
  publicId: true,
  key: true,
  name: true,
} as const;

const REPRESENTATIVE_SELECT = {
  id: true,
  userId: true,
  email: true,
  fullname: true,
} as const;

const TENANT_MEMBER_LIST_SELECT = {
  userId: true,
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
} satisfies Prisma.UserSelect;

const TENANT_MEMBER_DETAIL_SELECT = {
  userId: true,
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

const TENANT_ROLE_INSPECTION_SELECT = {
  publicId: true,
  key: true,
  name: true,
  description: true,
  rolePermissions: {
    select: {
      permission: {
        select: { name: true },
      },
    },
    orderBy: { permission: { name: 'asc' as const } },
  },
  _count: {
    select: { userRoles: true },
  },
} satisfies Prisma.RoleSelect;

type TenantOnboardingRecord = Prisma.TenantGetPayload<{
  select: typeof TENANT_ONBOARDING_SELECT;
}>;

export interface TenantOnboardingResponse {
  uuid: string;
  tenantCode: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  brandColor: string | null;
  isActive: boolean;
  isDemo: boolean;
  subscriptionStatus: SubscriptionStatus;
  paymentStatus: PaymentStatus;
  trialEndsAt: Date | null;
  createdAt: Date;
  administrator: {
    userId: string;
    email: string | null;
    fullname: string;
    linkedExistingAccount: boolean;
    role: {
      publicId: string;
      key: string;
      name: string;
    };
  };
}

export interface PlatformTenantListItem {
  uuid: string;
  tenantCode: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  brandColor: string | null;
  isActive: boolean;
  isDemo: boolean;
  subscriptionStatus: SubscriptionStatus;
  paymentStatus: PaymentStatus;
  trialEndsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  totalUsers: number;
  pendingApprovals: number;
  loanApplicationEligibility: TenantLoanApplicationEligibilityResponse;
}

export interface PlatformTenantMemberSummary {
  userId: string;
  fullname: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  isBlocked: boolean | null;
  isDeleted: boolean;
  roles: Array<{
    publicId: string;
    key: string;
    name: string;
  }>;
}

export interface PlatformTenantMemberDetail extends PlatformTenantMemberSummary {
  nationalId: string | null;
  gender: {
    genderId: number;
    gender: string;
  } | null;
  district: {
    id: number;
    districtName: string;
  } | null;
  roleAssignments: Array<{
    publicId: string;
    key: string;
    name: string;
    description: string | null;
  }>;
}

export interface PlatformTenantRoleSummary {
  publicId: string;
  key: string;
  name: string;
  description: string | null;
  permissions: string[];
  assignedUsers: number;
}

export interface PaginatedPlatformTenantMembersResponse {
  data: PlatformTenantMemberSummary[];
  pagination: {
    page: number;
    hasNextPage: boolean;
  };
}

export interface PlatformTenantDetail extends PlatformTenantListItem {
  members: PlatformTenantMemberSummary[];
  roles: PlatformTenantRoleSummary[];
  approvalRequests: Array<{
    publicId: string;
    entityType: string;
    payload: Prisma.JsonValue;
    previousData: Prisma.JsonValue | null;
    reason: string | null;
    rejectionReason: string | null;
    status: ApprovalRequestStatus;
    createdAt: Date;
    reviewedAt: Date | null;
    requestedBy: {
      userId: string;
      fullname: string;
    };
    reviewedBy: {
      userId: string;
      fullname: string;
    } | null;
  }>;
}

export interface PaginatedPlatformTenantsResponse {
  data: PlatformTenantListItem[];
  pagination: {
    page: number;
    hasNextPage: boolean;
  };
}

@Injectable()
export class PlatformTenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly emailService: BrevoEmailService,
    private readonly accountAccessTokenService: AccountAccessTokenService,
    private readonly eligibility: TenantLoanApplicationEligibilityService,
  ) {}

  async findAll(
    query: ListPlatformTenantsQueryDto,
  ): Promise<PaginatedPlatformTenantsResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.TenantWhereInput = {};
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }
    if (query.isDemo !== undefined) {
      where.isDemo = query.isDemo;
    }
    if (query.subscriptionStatus) {
      where.subscriptionStatus = query.subscriptionStatus;
    }
    if (query.paymentStatus) {
      where.paymentStatus = query.paymentStatus;
    }

    const rows = await this.prisma.tenant.findMany({
      where,
      select: {
        ...TENANT_INSPECTION_SELECT,
        _count: {
          select: {
            users: true,
            approvalRequests: {
              where: { status: ApprovalRequestStatus.PENDING },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit + 1,
    });

    const hasNextPage = rows.length > limit;
    const pageRows = hasNextPage ? rows.slice(0, limit) : rows;

    return {
      data: pageRows.map((row) => this.toListItem(row)),
      pagination: { page, hasNextPage },
    };
  }

  async findOne(uuid: string): Promise<PlatformTenantDetail> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { tenantId: uuid },
      select: {
        ...TENANT_INSPECTION_SELECT,
        _count: {
          select: {
            users: true,
            approvalRequests: {
              where: { status: ApprovalRequestStatus.PENDING },
            },
          },
        },
        users: {
          select: TENANT_MEMBER_LIST_SELECT,
          orderBy: { fullname: 'asc' },
        },
        roles: {
          where: { key: { not: SUPER_ADMIN_ROLE_KEY } },
          select: TENANT_ROLE_INSPECTION_SELECT,
          orderBy: { name: 'asc' },
        },
        approvalRequests: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: {
            publicId: true,
            entityType: true,
            payload: true,
            previousData: true,
            reason: true,
            rejectionReason: true,
            status: true,
            createdAt: true,
            reviewedAt: true,
            requestedBy: {
              select: { userId: true, fullname: true },
            },
            reviewedBy: {
              select: { userId: true, fullname: true },
            },
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return {
      ...this.toDetail(tenant),
      loanApplicationEligibility: await this.eligibility.getForRead(
        tenant.tenantId,
      ),
    };
  }

  async findMembers(
    uuid: string,
    query: ListPlatformTenantMembersQueryDto,
  ): Promise<PaginatedPlatformTenantMembersResponse> {
    await this.assertTenantExists(uuid);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const users = await this.prisma.user.findMany({
      where: this.buildMemberListWhere(uuid, query),
      select: TENANT_MEMBER_LIST_SELECT,
      orderBy: { fullname: 'asc' },
      skip,
      take: limit + 1,
    });

    const hasNextPage = users.length > limit;
    const pageUsers = hasNextPage ? users.slice(0, limit) : users;

    return {
      data: pageUsers.map((user) => this.toMemberSummary(user)),
      pagination: { page, hasNextPage },
    };
  }

  async findMember(
    uuid: string,
    userId: string,
  ): Promise<PlatformTenantMemberDetail> {
    await this.assertTenantExists(uuid);

    const user = await this.prisma.user.findFirst({
      where: {
        tenantId: uuid,
        userId,
      },
      select: TENANT_MEMBER_DETAIL_SELECT,
    });

    if (!user) {
      throw new NotFoundException('Member not found');
    }

    return this.toMemberDetail(user);
  }

  async assignMember(
    uuid: string,
    dto: AssignPlatformTenantMemberDto,
    auditContext: AuditContext,
  ): Promise<PlatformTenantMemberDetail> {
    await this.assertTenantExists(uuid);

    const user = await this.prisma.user.findFirst({
      where: platformUserWhere({ userId: dto.userId }),
      select: {
        id: true,
        userId: true,
        tenantId: true,
        deletedAt: true,
        userRoles: {
          select: {
            role: { select: { key: true } },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    this.assertPlatformUserCanJoinTenant(user);

    await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({
        where: { userId: user.id },
      });

      await tx.user.update({
        where: { id: user.id },
        data: {
          tenantId: uuid,
          sessionState: Prisma.DbNull,
        },
      });
    });

    await this.auditService.record({
      ...auditContext,
      tenantId: uuid,
      module: 'PLATFORM',
      action: TENANT_ONBOARDING_AUDIT_ACTIONS.MEMBER_ASSIGNED,
      targetId: user.userId,
      targetType: 'User',
      payload: {
        tenantId: uuid,
        userId: user.userId,
        rolesCleared: true,
      },
    });

    return this.findMember(uuid, user.userId);
  }

  async onboard(
    dto: OnboardTenantDto,
    auditContext: AuditContext,
    frontendOrigin: string,
  ): Promise<TenantOnboardingResponse> {
    await this.assertTenantIdentifiersAvailable(dto.slug, dto.tenantCode);
    this.assertNotReservedRepresentative(
      dto.representative.email,
      dto.representative.userId,
    );

    const existingUser = await this.prisma.user.findFirst({
      where: platformUserWhere({ email: dto.representative.email }),
      select: {
        id: true,
        userId: true,
        email: true,
        fullname: true,
        tenantId: true,
        deletedAt: true,
        userRoles: {
          select: {
            role: { select: { key: true } },
          },
        },
      },
    });

    if (existingUser) {
      this.assertPlatformUserCanJoinTenant(existingUser);
    } else {
      await this.assertNewRepresentativeAvailable(dto);
      await this.validateOptionalForeignKeys(
        dto.representative.genderId,
        dto.representative.districtId,
      );
    }

    const lockedPassword = existingUser
      ? null
      : await this.generateLockedPassword();

    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          tenantCode: dto.tenantCode,
          isDemo: dto.isDemo ?? false,
          subscriptionStatus:
            dto.subscriptionStatus ?? SubscriptionStatus.TRIAL,
          paymentStatus: dto.paymentStatus ?? PaymentStatus.PENDING,
          trialEndsAt: dto.trialEndsAt ?? null,
        },
        select: TENANT_ONBOARDING_SELECT,
      });

      await tx.loanApplicationSetting.create({
        data: {
          tenantId: tenant.tenantId,
          applicationStatusVisibleToApplicant: false,
          minLoanAmount: 10000,
          maxLoanAmount: 1000000,
        },
      });

      const tenantPermissions = await tx.permission.findMany({
        where: {
          OR: [
            { name: { startsWith: TENANT_PERMISSION_PREFIX } },
            { name: { startsWith: SELF_PERMISSION_PREFIX } },
            { name: { in: [...GLOBAL_INBOX_PERMISSIONS] } },
            { name: { startsWith: CUSTOMER_OPS_PERMISSION_PREFIX } },
          ],
        },
        select: { permissionId: true },
      });

      if (tenantPermissions.length === 0) {
        throw new InternalServerErrorException(
          'Tenant permission catalog is empty; cannot seed the Administrator role',
        );
      }

      const administratorRole = await tx.role.create({
        data: {
          key: TENANT_ADMINISTRATOR_ROLE.key,
          name: TENANT_ADMINISTRATOR_ROLE.name,
          description: TENANT_ADMINISTRATOR_ROLE.description,
          tenantId: tenant.tenantId,
          rolePermissions: {
            createMany: {
              data: tenantPermissions.map((permission) => ({
                permissionId: permission.permissionId,
              })),
            },
          },
        },
        select: { roleId: true, ...ADMINISTRATOR_ROLE_SELECT },
      });

      let linkedExistingAccount = false;
      let representative: Prisma.UserGetPayload<{
        select: typeof REPRESENTATIVE_SELECT;
      }>;

      if (existingUser) {
        await tx.userRole.deleteMany({
          where: { userId: existingUser.id },
        });

        representative = await tx.user.update({
          where: { id: existingUser.id },
          data: { tenantId: tenant.tenantId },
          select: REPRESENTATIVE_SELECT,
        });

        await tx.userRole.create({
          data: {
            userId: representative.id,
            roleId: administratorRole.roleId,
            tenantId: tenant.tenantId,
          },
        });

        linkedExistingAccount = true;
      } else {
        if (!lockedPassword) {
          throw new InternalServerErrorException(
            'Failed to provision administrator credentials',
          );
        }

        representative = await tx.user.create({
          data: {
            userId: dto.representative.userId,
            email: dto.representative.email,
            fullname: this.composeFullname(
              dto.representative.firstName,
              dto.representative.lastName,
            ),
            nationalId: dto.representative.nationalId,
            phone: dto.representative.phone,
            genderId: dto.representative.genderId,
            districtId: dto.representative.districtId,
            password: lockedPassword,
            tenantId: tenant.tenantId,
            userRoles: {
              create: {
                roleId: administratorRole.roleId,
                tenantId: tenant.tenantId,
              },
            },
          },
          select: REPRESENTATIVE_SELECT,
        });
      }

      return {
        tenant,
        administratorRole: {
          publicId: administratorRole.publicId,
          key: administratorRole.key,
          name: administratorRole.name,
        },
        representative,
        linkedExistingAccount,
      };
    });

    await this.auditService.record({
      ...auditContext,
      tenantId: result.tenant.tenantId,
      module: 'PLATFORM',
      action: TENANT_ONBOARDING_AUDIT_ACTIONS.ONBOARDED,
      targetId: result.tenant.tenantId,
      targetType: 'Tenant',
      payload: {
        uuid: result.tenant.tenantId,
        slug: result.tenant.slug,
        tenantCode: result.tenant.tenantCode,
        representativeEmail: result.representative.email,
        representativeUserId: result.representative.userId,
        linkedExistingAccount: result.linkedExistingAccount,
        administratorRolePublicId: result.administratorRole.publicId,
      },
    });

    await this.eligibility.refresh(result.tenant.tenantId);

    if (!result.linkedExistingAccount && result.representative.email) {
      await this.sendAdministratorSetupEmail(
        result.representative.userId,
        result.representative.fullname,
        result.representative.email,
        frontendOrigin,
      );
    }

    return this.toResponse(
      result.tenant,
      result.representative,
      result.administratorRole,
      result.linkedExistingAccount,
    );
  }

  private async sendAdministratorSetupEmail(
    userId: string,
    fullname: string,
    email: string,
    frontendOrigin: string,
  ): Promise<void> {
    const setupToken = await this.accountAccessTokenService.sign(userId);
    const setupUrl = buildAccountSetupUrl(frontendOrigin, userId, setupToken);
    const emailContent = buildAccountInvitationEmail({
      fullname,
      setupUrl,
    });

    void this.emailService.send({
      to: email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });
  }

  private composeFullname(firstName: string, lastName: string): string {
    return `${firstName.trim()} ${lastName.trim()}`.trim();
  }

  private async assertTenantIdentifiersAvailable(
    slug: string,
    tenantCode: string,
  ): Promise<void> {
    const existing = await this.prisma.tenant.findFirst({
      where: { OR: [{ slug }, { tenantCode }] },
      select: { slug: true, tenantCode: true },
    });

    if (!existing) {
      return;
    }

    if (existing.slug === slug) {
      throw new ConflictException('Slug is already in use');
    }

    throw new ConflictException('Tenant code is already in use');
  }

  private assertNotReservedRepresentative(email: string, userId: string): void {
    const emailLower = email.toLowerCase();
    if (
      userId === SYSTEM_ROOT_USER_ID ||
      emailLower === SYSTEM_ROOT_USER_EMAIL.toLowerCase()
    ) {
      throw new ForbiddenException(
        'The platform root account cannot be assigned as an organization administrator',
      );
    }
  }

  private assertPlatformUserCanJoinTenant(user: {
    userId: string;
    tenantId: string | null;
    deletedAt: Date | null;
    userRoles: Array<{ role: { key: string } }>;
  }): void {
    if (user.userId === SYSTEM_ROOT_USER_ID) {
      throw new ForbiddenException(
        'The platform root account cannot be assigned to an organization',
      );
    }

    if (
      user.userRoles.some(
        (assignment) => assignment.role.key === SUPER_ADMIN_ROLE_KEY,
      )
    ) {
      throw new ForbiddenException(
        'Super Admin accounts cannot be assigned to an organization',
      );
    }

    if (user.deletedAt) {
      throw new BadRequestException(
        'This account is deleted and cannot be assigned to an organization',
      );
    }

    if (user.tenantId) {
      throw new ConflictException(
        'This account already belongs to an organization',
      );
    }
  }

  private async assertNewRepresentativeAvailable(
    dto: OnboardTenantDto,
  ): Promise<void> {
    const existingByUserId = await this.prisma.user.findUnique({
      where: { userId: dto.representative.userId },
      select: { userId: true },
    });

    if (existingByUserId) {
      throw new ConflictException('Username is already in use');
    }

    const existingNationalId = await this.prisma.user.findFirst({
      where: { nationalId: dto.representative.nationalId },
      select: { userId: true },
    });

    if (existingNationalId) {
      throw new ConflictException('National ID is already in use');
    }
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

  private toResponse(
    tenant: TenantOnboardingRecord,
    representative: Prisma.UserGetPayload<{
      select: typeof REPRESENTATIVE_SELECT;
    }>,
    role: { publicId: string; key: string; name: string },
    linkedExistingAccount: boolean,
  ): TenantOnboardingResponse {
    return {
      uuid: tenant.tenantId,
      tenantCode: tenant.tenantCode,
      slug: tenant.slug,
      name: tenant.name,
      logoUrl: resolveTenantLogoUrl({
        logoUrl: tenant.logoUrl,
        logoImgName: tenant.brandProfile?.logoImgName,
      }),
      brandColor: tenant.brandColor,
      isActive: tenant.isActive,
      isDemo: tenant.isDemo,
      subscriptionStatus: tenant.subscriptionStatus,
      paymentStatus: tenant.paymentStatus,
      trialEndsAt: tenant.trialEndsAt,
      createdAt: tenant.createdAt,
      administrator: {
        userId: representative.userId,
        email: representative.email,
        fullname: representative.fullname,
        linkedExistingAccount,
        role: {
          publicId: role.publicId,
          key: role.key,
          name: role.name,
        },
      },
    };
  }

  private toListItem(tenant: {
    tenantId: string;
    tenantCode: string;
    slug: string;
    name: string;
    logoUrl: string | null;
    brandColor: string | null;
    isActive: boolean;
    isDemo: boolean;
    subscriptionStatus: SubscriptionStatus;
    paymentStatus: PaymentStatus;
    trialEndsAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    brandProfile: { logoImgName: string | null } | null;
    loanApplicationEligibility: Parameters<
      typeof toTenantLoanApplicationEligibilityResponse
    >[1];
    _count: { users: number; approvalRequests: number };
  }): PlatformTenantListItem {
    return {
      uuid: tenant.tenantId,
      tenantCode: tenant.tenantCode,
      slug: tenant.slug,
      name: tenant.name,
      logoUrl: resolveTenantLogoUrl({
        logoUrl: tenant.logoUrl,
        logoImgName: tenant.brandProfile?.logoImgName,
      }),
      brandColor: tenant.brandColor,
      isActive: tenant.isActive,
      isDemo: tenant.isDemo,
      subscriptionStatus: tenant.subscriptionStatus,
      paymentStatus: tenant.paymentStatus,
      trialEndsAt: tenant.trialEndsAt,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
      totalUsers: tenant._count.users,
      pendingApprovals: tenant._count.approvalRequests,
      loanApplicationEligibility: toTenantLoanApplicationEligibilityResponse(
        tenant,
        tenant.loanApplicationEligibility,
      ),
    };
  }

  private toDetail(
    tenant: Parameters<PlatformTenantsService['toListItem']>[0] & {
      users: Array<
        Prisma.UserGetPayload<{ select: typeof TENANT_MEMBER_LIST_SELECT }>
      >;
      roles: Array<
        Prisma.RoleGetPayload<{ select: typeof TENANT_ROLE_INSPECTION_SELECT }>
      >;
      approvalRequests: PlatformTenantDetail['approvalRequests'];
    },
  ): PlatformTenantDetail {
    return {
      ...this.toListItem(tenant),
      members: tenant.users.map((user) => this.toMemberSummary(user)),
      roles: tenant.roles.map((role) => this.toRoleSummary(role)),
      approvalRequests: tenant.approvalRequests,
    };
  }

  private toMemberSummary(
    user: Prisma.UserGetPayload<{ select: typeof TENANT_MEMBER_LIST_SELECT }>,
  ): PlatformTenantMemberSummary {
    return {
      userId: user.userId,
      fullname: user.fullname,
      email: user.email,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      isBlocked: user.isBlocked,
      isDeleted: user.deletedAt !== null,
      roles: user.userRoles.map(({ role }) => ({
        publicId: role.publicId,
        key: role.key,
        name: role.name,
      })),
    };
  }

  private toMemberDetail(
    user: Prisma.UserGetPayload<{ select: typeof TENANT_MEMBER_DETAIL_SELECT }>,
  ): PlatformTenantMemberDetail {
    return {
      ...this.toMemberSummary({
        ...user,
        userRoles: user.userRoles,
      }),
      nationalId: user.nationalId,
      gender: user.genders,
      district: user.districts,
      roleAssignments: user.userRoles.map(({ role }) => ({
        publicId: role.publicId,
        key: role.key,
        name: role.name,
        description: role.description,
      })),
    };
  }

  private toRoleSummary(
    role: Prisma.RoleGetPayload<{
      select: typeof TENANT_ROLE_INSPECTION_SELECT;
    }>,
  ): PlatformTenantRoleSummary {
    return {
      publicId: role.publicId,
      key: role.key,
      name: role.name,
      description: role.description,
      permissions: role.rolePermissions.map(
        ({ permission }) => permission.name,
      ),
      assignedUsers: role._count.userRoles,
    };
  }

  private async assertTenantExists(uuid: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { tenantId: uuid },
      select: { tenantId: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
  }

  private buildMemberListWhere(
    tenantId: string,
    query: ListPlatformTenantMembersQueryDto,
  ): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = { tenantId };

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

    return where;
  }
}
