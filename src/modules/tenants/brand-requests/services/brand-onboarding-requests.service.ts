import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  OnboardingRequestStatus,
  Prisma,
  SubscriptionStatus,
} from '@prisma/client';
import type { AuditContext } from '../../../../core/audit/interfaces/audit-payload.interface';
import { AuditService } from '../../../../core/audit/services/audit.service';
import { PrismaService } from '../../../../core/database/prisma.service';
import { BrevoEmailService } from '../../../../core/email/services/brevo-email.service';
import { PLATFORM_NOTIFICATION_ACTIONS } from '../../../../core/notifications/constants/notification-action-keys.constant';
import { NOTIFICATION_TYPES } from '../../../../core/notifications/constants/notification-type.constant';
import { NotificationDispatcherService } from '../../../../core/notifications/services/notification-dispatcher.service';
import {
  SUPER_ADMIN_ROLE_KEY,
  SYSTEM_ROOT_USER_ID,
} from '../../../auth/shared/constants/roles.constant';
import {
  CUSTOMER_OPS_PERMISSION_PREFIX,
  GLOBAL_INBOX_PERMISSIONS,
  SELF_PERMISSION_PREFIX,
  TENANT_PERMISSION_PREFIX,
} from '../../../roles/shared/utils/role-permission-scope.util';
import { TENANT_ADMINISTRATOR_ROLE } from '../../platform/constants/tenant-onboarding.constant';
import { TenantLoanApplicationEligibilityService } from '../../shared/services/tenant-loan-application-eligibility.service';
import { BRAND_ONBOARDING_AUDIT_ACTIONS } from '../constants/brand-onboarding-audit-actions.constant';
import { ApproveBrandOnboardingRequestDto } from '../dto/approve-brand-onboarding-request.dto';
import { CreateBrandOnboardingRequestDto } from '../dto/create-brand-onboarding-request.dto';
import { ListBrandOnboardingRequestsQueryDto } from '../dto/list-brand-onboarding-requests-query.dto';
import { RejectBrandOnboardingRequestDto } from '../dto/reject-brand-onboarding-request.dto';
import { UpdateBrandOnboardingRequestDto } from '../dto/update-brand-onboarding-request.dto';
import { buildBrandOnboardingApprovedEmail } from '../templates/brand-onboarding-approved.email';
import { buildBrandOnboardingRejectedEmail } from '../templates/brand-onboarding-rejected.email';

const APPLICANT_SELECT = {
  id: true,
  userId: true,
  fullname: true,
  email: true,
  phone: true,
} as const;

const REVIEWER_SELECT = {
  userId: true,
  fullname: true,
} as const;

const BRAND_ONBOARDING_REQUEST_SELECT = {
  publicId: true,
  brandName: true,
  slug: true,
  tenantCode: true,
  contactPhone: true,
  contactEmail: true,
  status: true,
  rejectionReason: true,
  createdTenantId: true,
  createdAt: true,
  updatedAt: true,
  reviewedAt: true,
  requestedBy: { select: APPLICANT_SELECT },
  reviewedBy: { select: REVIEWER_SELECT },
} as const;

const ADMINISTRATOR_ROLE_SELECT = {
  publicId: true,
  key: true,
  name: true,
} as const;

type BrandOnboardingRequestRecord = Prisma.BrandOnboardingRequestGetPayload<{
  select: typeof BRAND_ONBOARDING_REQUEST_SELECT;
}>;

type BrandOnboardingRequestUpdateFields = {
  brandName?: string;
  slug?: string;
  tenantCode?: string;
  contactEmail?: string;
  contactPhone?: string | null;
};

type BrandOnboardingCaller = {
  id: number;
  userId: string;
  tenantId: string | null;
};

export interface BrandOnboardingApplicant {
  userId: string;
  fullname: string;
  email: string | null;
  phone: string | null;
}

export interface BrandOnboardingReviewer {
  userId: string;
  fullname: string;
}

export interface BrandOnboardingRequestResponse {
  publicId: string;
  brandName: string;
  slug: string;
  tenantCode: string;
  contactPhone: string | null;
  contactEmail: string;
  status: OnboardingRequestStatus;
  rejectionReason: string | null;
  createdTenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
  reviewedAt: Date | null;
  requestedBy: BrandOnboardingApplicant;
  reviewedBy: BrandOnboardingReviewer | null;
}

export interface PaginatedBrandOnboardingRequestsResponse {
  data: BrandOnboardingRequestResponse[];
  pagination: {
    page: number;
    hasNextPage: boolean;
  };
}

@Injectable()
export class BrandOnboardingRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly emailService: BrevoEmailService,
    private readonly eligibility: TenantLoanApplicationEligibilityService,
    private readonly notificationDispatcher: NotificationDispatcherService,
  ) {}

  async submit(
    caller: BrandOnboardingCaller,
    dto: CreateBrandOnboardingRequestDto,
    auditContext: AuditContext,
  ): Promise<BrandOnboardingRequestResponse> {
    this.assertPlatformCustomerCaller(caller);
    await this.assertApplicantCanSubmit(caller.id);
    await this.assertIdentifiersAvailable(dto.slug, dto.tenantCode);

    const created = await this.prisma.brandOnboardingRequest.create({
      data: {
        requestedById: caller.id,
        brandName: dto.brandName.trim(),
        slug: dto.slug,
        tenantCode: dto.tenantCode,
        contactEmail: dto.contactEmail.trim(),
        contactPhone: dto.contactPhone?.trim() || null,
      },
      select: BRAND_ONBOARDING_REQUEST_SELECT,
    });

    await this.auditService.record({
      ...auditContext,
      module: 'PLATFORM',
      action: BRAND_ONBOARDING_AUDIT_ACTIONS.SUBMITTED,
      targetId: created.publicId,
      targetType: 'BrandOnboardingRequest',
      payload: {
        publicId: created.publicId,
        slug: created.slug,
        tenantCode: created.tenantCode,
        brandName: created.brandName,
      },
    });

    void this.notificationDispatcher.dispatch(
      PLATFORM_NOTIFICATION_ACTIONS.BRAND_ONBOARDING.SUBMITTED,
      {
        subject: 'Brand registration request submitted',
        message: `${created.brandName} (${created.tenantCode}) submitted a brand registration request.`,
        templateData: {
          organization: created.brandName,
          publicId: created.publicId,
          slug: created.slug,
          tenantCode: created.tenantCode,
          brandName: created.brandName,
          contactEmail: created.contactEmail,
        },
      },
    );

    return this.toResponse(created);
  }

  async findMine(id: number): Promise<BrandOnboardingRequestResponse[]> {
    const rows = await this.prisma.brandOnboardingRequest.findMany({
      where: { requestedById: id },
      select: BRAND_ONBOARDING_REQUEST_SELECT,
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => this.toResponse(row));
  }

  async updateMine(
    caller: BrandOnboardingCaller,
    publicId: string,
    dto: UpdateBrandOnboardingRequestDto,
    auditContext: AuditContext,
  ): Promise<BrandOnboardingRequestResponse> {
    this.assertPlatformCustomerCaller(caller);

    const data = this.toUpdateData(dto);
    if (Object.keys(data).length === 0) {
      throw new BadRequestException(
        'Provide at least one field to update on the brand onboarding request',
      );
    }

    const request = await this.loadOwnRequest(caller.id, publicId);
    this.assertPending(
      request,
      'Only pending brand onboarding requests can be updated',
    );

    const nextSlug = data.slug ?? request.slug;
    const nextTenantCode = data.tenantCode ?? request.tenantCode;
    if (nextSlug !== request.slug || nextTenantCode !== request.tenantCode) {
      await this.assertIdentifiersAvailable(nextSlug, nextTenantCode, {
        excludePublicId: publicId,
      });
    }

    const updated = await this.prisma.brandOnboardingRequest.update({
      where: { publicId },
      data,
      select: BRAND_ONBOARDING_REQUEST_SELECT,
    });

    await this.auditService.record({
      ...auditContext,
      module: 'PLATFORM',
      action: BRAND_ONBOARDING_AUDIT_ACTIONS.UPDATED,
      targetId: updated.publicId,
      targetType: 'BrandOnboardingRequest',
      payload: {
        publicId: updated.publicId,
        ...data,
      },
    });

    return this.toResponse(updated);
  }

  async cancelMine(
    caller: BrandOnboardingCaller,
    publicId: string,
    auditContext: AuditContext,
  ): Promise<BrandOnboardingRequestResponse> {
    this.assertPlatformCustomerCaller(caller);

    const request = await this.loadOwnRequest(caller.id, publicId);
    this.assertPending(
      request,
      'Only pending brand onboarding requests can be cancelled',
    );

    const updated = await this.prisma.brandOnboardingRequest.update({
      where: { publicId },
      data: { status: OnboardingRequestStatus.CANCELLED },
      select: BRAND_ONBOARDING_REQUEST_SELECT,
    });

    await this.auditService.record({
      ...auditContext,
      module: 'PLATFORM',
      action: BRAND_ONBOARDING_AUDIT_ACTIONS.CANCELLED,
      targetId: updated.publicId,
      targetType: 'BrandOnboardingRequest',
      payload: {
        publicId: updated.publicId,
        slug: updated.slug,
        tenantCode: updated.tenantCode,
      },
    });

    return this.toResponse(updated);
  }

  async findAll(
    query: ListBrandOnboardingRequestsQueryDto,
  ): Promise<PaginatedBrandOnboardingRequestsResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.BrandOnboardingRequestWhereInput = {};
    if (query.status) {
      where.status = query.status;
    }

    const rows = await this.prisma.brandOnboardingRequest.findMany({
      where,
      select: BRAND_ONBOARDING_REQUEST_SELECT,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit + 1,
    });

    const hasNextPage = rows.length > limit;
    const pageRows = hasNextPage ? rows.slice(0, limit) : rows;

    return {
      data: pageRows.map((row) => this.toResponse(row)),
      pagination: { page, hasNextPage },
    };
  }

  async findOne(publicId: string): Promise<BrandOnboardingRequestResponse> {
    return this.toResponse(await this.loadRequest(publicId));
  }

  async reject(
    publicId: string,
    reviewerId: number,
    dto: RejectBrandOnboardingRequestDto,
    auditContext: AuditContext,
  ): Promise<BrandOnboardingRequestResponse> {
    const request = await this.loadRequest(publicId);
    this.assertPending(request);

    const updated = await this.prisma.brandOnboardingRequest.update({
      where: { publicId },
      data: {
        status: OnboardingRequestStatus.REJECTED,
        rejectionReason: dto.rejectionReason.trim(),
        reviewedById: reviewerId,
        reviewedAt: new Date(),
      },
      select: BRAND_ONBOARDING_REQUEST_SELECT,
    });

    await this.auditService.record({
      ...auditContext,
      module: 'PLATFORM',
      action: BRAND_ONBOARDING_AUDIT_ACTIONS.REJECTED,
      targetId: updated.publicId,
      targetType: 'BrandOnboardingRequest',
      payload: {
        publicId: updated.publicId,
        slug: updated.slug,
        tenantCode: updated.tenantCode,
        rejectionReason: updated.rejectionReason,
      },
    });

    this.notifyApplicantRejected(updated);

    return this.toResponse(updated);
  }

  async approve(
    publicId: string,
    reviewerId: number,
    dto: ApproveBrandOnboardingRequestDto,
    auditContext: AuditContext,
  ): Promise<BrandOnboardingRequestResponse> {
    const result = await this.prisma.$transaction(async (tx) => {
      const request = await tx.brandOnboardingRequest.findUnique({
        where: { publicId },
        select: {
          ...BRAND_ONBOARDING_REQUEST_SELECT,
          requestedById: true,
        },
      });

      if (!request) {
        throw new NotFoundException('Brand onboarding request not found');
      }

      this.assertPending(request);
      await this.assertIdentifiersAvailable(request.slug, request.tenantCode, {
        db: tx,
        excludePublicId: publicId,
      });

      const applicant = await tx.user.findUnique({
        where: { id: request.requestedById },
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

      if (!applicant) {
        throw new NotFoundException('Applicant not found');
      }

      this.assertApplicantCanJoinTenant(applicant);

      const tenant = await tx.tenant.create({
        data: {
          name: request.brandName,
          slug: request.slug,
          tenantCode: request.tenantCode,
          isActive: true,
          subscriptionStatus: SubscriptionStatus.TRIAL,
          trialEndsAt: dto.trialEndsAt ?? null,
        },
        select: { tenantId: true },
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

      await tx.userRole.deleteMany({
        where: { userId: applicant.id },
      });

      await tx.user.update({
        where: { id: applicant.id },
        data: {
          tenantId: tenant.tenantId,
          sessionState: Prisma.DbNull,
        },
      });

      await tx.userRole.create({
        data: {
          userId: applicant.id,
          roleId: administratorRole.roleId,
          tenantId: tenant.tenantId,
        },
      });

      await tx.tenantBrandProfile.create({
        data: {
          tenantId: tenant.tenantId,
          brandName: request.brandName,
          contactEmail: request.contactEmail,
          contactPhone: request.contactPhone,
        },
      });

      await tx.loanApplicationSetting.create({
        data: {
          tenantId: tenant.tenantId,
          applicationStatusVisibleToApplicant: false,
          minLoanAmount: 10000,
          maxLoanAmount: 1000000,
        },
      });

      const reviewedAt = new Date();
      const updated = await tx.brandOnboardingRequest.update({
        where: { publicId },
        data: {
          status: OnboardingRequestStatus.APPROVED,
          createdTenantId: tenant.tenantId,
          reviewedById: reviewerId,
          reviewedAt,
        },
        select: BRAND_ONBOARDING_REQUEST_SELECT,
      });

      await tx.notification.create({
        data: {
          notificationType: NOTIFICATION_TYPES.INFO,
          targetUser: applicant.id,
          content: `Your brand onboarding request for ${request.brandName} has been approved. You now administer this organization.`,
          date: reviewedAt,
        },
      });

      return {
        updated,
        tenantId: tenant.tenantId,
        administratorRolePublicId: administratorRole.publicId,
      };
    });

    await this.auditService.record({
      ...auditContext,
      tenantId: result.tenantId,
      module: 'PLATFORM',
      action: BRAND_ONBOARDING_AUDIT_ACTIONS.APPROVED,
      targetId: result.updated.publicId,
      targetType: 'BrandOnboardingRequest',
      payload: {
        publicId: result.updated.publicId,
        slug: result.updated.slug,
        tenantCode: result.updated.tenantCode,
        createdTenantId: result.tenantId,
        administratorRolePublicId: result.administratorRolePublicId,
        applicantId: result.updated.requestedBy.userId,
      },
    });

    await this.eligibility.refresh(result.tenantId);
    this.dispatchApprovalEmail(result.updated);

    return this.toResponse(result.updated);
  }

  private async loadRequest(
    publicId: string,
  ): Promise<BrandOnboardingRequestRecord> {
    const request = await this.prisma.brandOnboardingRequest.findUnique({
      where: { publicId },
      select: BRAND_ONBOARDING_REQUEST_SELECT,
    });

    if (!request) {
      throw new NotFoundException('Brand onboarding request not found');
    }

    return request;
  }

  private async loadOwnRequest(
    callerId: number,
    publicId: string,
  ): Promise<BrandOnboardingRequestRecord> {
    const request = await this.loadRequest(publicId);

    if (request.requestedBy.id !== callerId) {
      throw new NotFoundException('Brand onboarding request not found');
    }

    return request;
  }

  private assertPending(
    request: { status: OnboardingRequestStatus },
    message = 'Only pending brand onboarding requests can be reviewed',
  ): void {
    if (request.status !== OnboardingRequestStatus.PENDING) {
      throw new ConflictException(message);
    }
  }

  private assertPlatformCustomerCaller(caller: BrandOnboardingCaller): void {
    if (caller.userId === SYSTEM_ROOT_USER_ID) {
      throw new ForbiddenException(
        'The platform root account cannot submit a brand onboarding request',
      );
    }

    if (caller.tenantId) {
      throw new ForbiddenException(
        'Only platform customer accounts can manage brand onboarding requests',
      );
    }
  }

  private async assertApplicantCanSubmit(id: number): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
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

    this.assertApplicantCanJoinTenant(user);

    const pending = await this.prisma.brandOnboardingRequest.findFirst({
      where: {
        requestedById: id,
        status: OnboardingRequestStatus.PENDING,
      },
      select: { publicId: true },
    });

    if (pending) {
      throw new ConflictException(
        'You already have a pending brand onboarding request',
      );
    }
  }

  private assertApplicantCanJoinTenant(user: {
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

  private async assertIdentifiersAvailable(
    slug: string,
    tenantCode: string,
    options: {
      db?: Prisma.TransactionClient | PrismaService;
      excludePublicId?: string;
    } = {},
  ): Promise<void> {
    const db = options.db ?? this.prisma;
    const requestWhere: Prisma.BrandOnboardingRequestWhereInput = {
      status: OnboardingRequestStatus.PENDING,
      OR: [{ slug }, { tenantCode }],
      ...(options.excludePublicId
        ? { publicId: { not: options.excludePublicId } }
        : {}),
    };

    const [existingTenant, existingRequest] = await Promise.all([
      db.tenant.findFirst({
        where: { OR: [{ slug }, { tenantCode }] },
        select: { slug: true, tenantCode: true },
      }),
      db.brandOnboardingRequest.findFirst({
        where: requestWhere,
        select: { slug: true, tenantCode: true },
      }),
    ]);

    if (existingTenant?.slug === slug || existingRequest?.slug === slug) {
      throw new ConflictException('Slug is already in use');
    }

    if (
      existingTenant?.tenantCode === tenantCode ||
      existingRequest?.tenantCode === tenantCode
    ) {
      throw new ConflictException('Tenant code is already in use');
    }
  }

  private notifyApplicantRejected(request: BrandOnboardingRequestRecord): void {
    void this.prisma.notification.create({
      data: {
        notificationType: NOTIFICATION_TYPES.INFO,
        targetUser: request.requestedBy.id,
        content: `Your brand onboarding request for ${request.brandName} was declined. Reason: ${request.rejectionReason ?? 'No reason provided'}.`,
        date: new Date(),
      },
    });

    if (!request.requestedBy.email) {
      return;
    }

    const emailContent = buildBrandOnboardingRejectedEmail({
      fullname: request.requestedBy.fullname,
      brandName: request.brandName,
      rejectionReason: request.rejectionReason ?? 'No reason provided',
    });

    void this.emailService.send({
      to: request.requestedBy.email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });
  }

  private dispatchApprovalEmail(request: BrandOnboardingRequestRecord): void {
    if (!request.requestedBy.email) {
      return;
    }

    const emailContent = buildBrandOnboardingApprovedEmail({
      fullname: request.requestedBy.fullname,
      brandName: request.brandName,
      slug: request.slug,
      tenantCode: request.tenantCode,
    });

    void this.emailService.send({
      to: request.requestedBy.email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });
  }

  private toUpdateData(
    dto: UpdateBrandOnboardingRequestDto,
  ): BrandOnboardingRequestUpdateFields {
    const data: BrandOnboardingRequestUpdateFields = {};

    if (dto.brandName !== undefined) {
      data.brandName = dto.brandName.trim();
    }
    if (dto.slug !== undefined) {
      data.slug = dto.slug;
    }
    if (dto.tenantCode !== undefined) {
      data.tenantCode = dto.tenantCode;
    }
    if (dto.contactEmail !== undefined) {
      data.contactEmail = dto.contactEmail.trim();
    }
    if (dto.contactPhone !== undefined) {
      data.contactPhone = dto.contactPhone.trim() || null;
    }

    return data;
  }

  private toResponse(
    request: BrandOnboardingRequestRecord,
  ): BrandOnboardingRequestResponse {
    return {
      publicId: request.publicId,
      brandName: request.brandName,
      slug: request.slug,
      tenantCode: request.tenantCode,
      contactPhone: request.contactPhone,
      contactEmail: request.contactEmail,
      status: request.status,
      rejectionReason: request.rejectionReason,
      createdTenantId: request.createdTenantId,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      reviewedAt: request.reviewedAt,
      requestedBy: {
        userId: request.requestedBy.userId,
        fullname: request.requestedBy.fullname,
        email: request.requestedBy.email,
        phone: request.requestedBy.phone,
      },
      reviewedBy: request.reviewedBy
        ? {
            userId: request.reviewedBy.userId,
            fullname: request.reviewedBy.fullname,
          }
        : null,
    };
  }
}
