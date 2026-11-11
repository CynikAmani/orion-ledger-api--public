import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalEntityType,
  ApprovalRequestStatus,
  Prisma,
} from '@prisma/client';
import type { AuditContext } from '../../../../core/audit/interfaces/audit-payload.interface';
import { AuditService } from '../../../../core/audit/services/audit.service';
import { PrismaService } from '../../../../core/database/prisma.service';
import { APPROVAL_AUDIT_ACTIONS } from '../constants/approval-audit-actions.constant';
import {
  CreateTenantApprovalRequestDto,
  ListApprovalRequestsQueryDto,
  RejectApprovalRequestDto,
} from '../dto/approval-request.dto';

const APPROVAL_ACTOR_SELECT = {
  userId: true,
  fullname: true,
  email: true,
} as const;

const APPROVAL_TENANT_SELECT = {
  tenantId: true,
  tenantCode: true,
  slug: true,
  name: true,
} as const;

const APPROVAL_REQUEST_SELECT = {
  publicId: true,
  entityType: true,
  payload: true,
  previousData: true,
  reason: true,
  rejectionReason: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  reviewedAt: true,
  tenant: { select: APPROVAL_TENANT_SELECT },
  requestedBy: { select: APPROVAL_ACTOR_SELECT },
  reviewedBy: { select: APPROVAL_ACTOR_SELECT },
} as const;

type ApprovalRequestRecord = Prisma.ApprovalRequestGetPayload<{
  select: typeof APPROVAL_REQUEST_SELECT;
}>;

export interface TenantChangePayload {
  slug?: string;
  name?: string;
}

export interface ApprovalRequestResponse {
  publicId: string;
  entityType: ApprovalEntityType;
  payload: TenantChangePayload;
  previousData: TenantChangePayload | null;
  reason: string | null;
  rejectionReason: string | null;
  status: ApprovalRequestStatus;
  createdAt: Date;
  updatedAt: Date;
  reviewedAt: Date | null;
  tenant: {
    uuid: string;
    tenantCode: string;
    slug: string;
    name: string;
  };
  requestedBy: {
    userId: string;
    fullname: string;
    email: string | null;
  };
  reviewedBy: {
    userId: string;
    fullname: string;
    email: string | null;
  } | null;
}

export interface PaginatedApprovalRequestsResponse {
  data: ApprovalRequestResponse[];
  pagination: {
    page: number;
    hasNextPage: boolean;
  };
}

@Injectable()
export class ApprovalRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async submitTenantChange(
    tenantId: string,
    requestedById: number,
    dto: CreateTenantApprovalRequestDto,
    auditContext: AuditContext,
  ): Promise<ApprovalRequestResponse> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { tenantId },
      select: { tenantId: true, slug: true, name: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const payload: TenantChangePayload = {};
    if (dto.slug !== undefined && dto.slug.trim() !== tenant.slug) {
      payload.slug = dto.slug.trim();
    }
    if (dto.name !== undefined && dto.name.trim() !== tenant.name) {
      payload.name = dto.name.trim();
    }

    if (!payload.slug && !payload.name) {
      throw new BadRequestException('No tenant field changes were submitted');
    }

    const entityType = this.resolveEntityType(payload);

    if (payload.slug) {
      await this.assertSlugAvailable(payload.slug, tenant.tenantId);
    }

    await this.assertNoOverlappingPendingRequest(tenant.tenantId, entityType);

    const previousData: TenantChangePayload = {};
    if (payload.slug !== undefined) {
      previousData.slug = tenant.slug;
    }
    if (payload.name !== undefined) {
      previousData.name = tenant.name;
    }

    const created = await this.prisma.approvalRequest.create({
      data: {
        tenantId: tenant.tenantId,
        requestedById,
        entityType,
        payload: payload as Prisma.InputJsonValue,
        previousData: previousData as Prisma.InputJsonValue,
        reason: dto.reason,
        status: ApprovalRequestStatus.PENDING,
      },
      select: APPROVAL_REQUEST_SELECT,
    });

    await this.auditService.record({
      ...auditContext,
      tenantId: tenant.tenantId,
      module: 'TENANT',
      action: APPROVAL_AUDIT_ACTIONS.SUBMITTED,
      targetId: created.publicId,
      targetType: 'ApprovalRequest',
      payload: {
        entityType,
        changes: payload,
      },
    });

    return this.toResponse(created);
  }

  async listPlatformQueue(
    query: ListApprovalRequestsQueryDto,
  ): Promise<PaginatedApprovalRequestsResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const rows = await this.prisma.approvalRequest.findMany({
      where: {
        status: query.status ?? ApprovalRequestStatus.PENDING,
        ...(query.entityType ? { entityType: query.entityType } : {}),
      },
      select: APPROVAL_REQUEST_SELECT,
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

  async approve(
    publicId: string,
    reviewedById: number,
    auditContext: AuditContext,
  ): Promise<ApprovalRequestResponse> {
    const existing = await this.loadPending(publicId);
    const changes = this.parsePayload(existing.payload);

    if (changes.slug) {
      await this.assertSlugAvailable(changes.slug, existing.tenant.tenantId);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (changes.slug || changes.name) {
        await tx.tenant.update({
          where: { tenantId: existing.tenant.tenantId },
          data: {
            ...(changes.slug ? { slug: changes.slug } : {}),
            ...(changes.name ? { name: changes.name } : {}),
          },
        });
      }

      return tx.approvalRequest.update({
        where: { publicId },
        data: {
          status: ApprovalRequestStatus.APPROVED,
          reviewedById,
          reviewedAt: new Date(),
        },
        select: APPROVAL_REQUEST_SELECT,
      });
    });

    await this.auditService.record({
      ...auditContext,
      tenantId: existing.tenant.tenantId,
      module: 'PLATFORM',
      action: APPROVAL_AUDIT_ACTIONS.APPROVED,
      targetId: publicId,
      targetType: 'ApprovalRequest',
      payload: {
        entityType: existing.entityType,
        applied: changes,
        tenantUuid: existing.tenant.tenantId,
      },
    });

    return this.toResponse(updated);
  }

  async reject(
    publicId: string,
    reviewedById: number,
    dto: RejectApprovalRequestDto,
    auditContext: AuditContext,
  ): Promise<ApprovalRequestResponse> {
    await this.loadPending(publicId);

    const updated = await this.prisma.approvalRequest.update({
      where: { publicId },
      data: {
        status: ApprovalRequestStatus.REJECTED,
        rejectionReason: dto.rejectionReason,
        reviewedById,
        reviewedAt: new Date(),
      },
      select: APPROVAL_REQUEST_SELECT,
    });

    await this.auditService.record({
      ...auditContext,
      tenantId: updated.tenant.tenantId,
      module: 'PLATFORM',
      action: APPROVAL_AUDIT_ACTIONS.REJECTED,
      targetId: publicId,
      targetType: 'ApprovalRequest',
      payload: {
        entityType: updated.entityType,
        rejectionReason: dto.rejectionReason,
      },
    });

    return this.toResponse(updated);
  }

  private async loadPending(publicId: string): Promise<ApprovalRequestRecord> {
    const request = await this.prisma.approvalRequest.findUnique({
      where: { publicId },
      select: APPROVAL_REQUEST_SELECT,
    });

    if (!request) {
      throw new NotFoundException('Approval request not found');
    }

    if (request.status !== ApprovalRequestStatus.PENDING) {
      throw new ConflictException(
        'Only pending approval requests can be reviewed',
      );
    }

    return request;
  }

  private resolveEntityType(payload: TenantChangePayload): ApprovalEntityType {
    if (payload.slug && payload.name) {
      return ApprovalEntityType.TENANT_PROFILE;
    }

    if (payload.slug) {
      return ApprovalEntityType.TENANT_SLUG;
    }

    return ApprovalEntityType.TENANT_NAME;
  }

  private overlappingEntityTypes(
    entityType: ApprovalEntityType,
  ): ApprovalEntityType[] {
    if (entityType === ApprovalEntityType.TENANT_PROFILE) {
      return [
        ApprovalEntityType.TENANT_PROFILE,
        ApprovalEntityType.TENANT_SLUG,
        ApprovalEntityType.TENANT_NAME,
      ];
    }

    return [entityType, ApprovalEntityType.TENANT_PROFILE];
  }

  private async assertNoOverlappingPendingRequest(
    tenantId: string,
    entityType: ApprovalEntityType,
  ): Promise<void> {
    const existing = await this.prisma.approvalRequest.findFirst({
      where: {
        tenantId,
        status: ApprovalRequestStatus.PENDING,
        entityType: { in: this.overlappingEntityTypes(entityType) },
      },
      select: { publicId: true },
    });

    if (existing) {
      throw new ConflictException(
        'A pending change request already covers this field',
      );
    }
  }

  private async assertSlugAvailable(
    slug: string,
    currentTenantId: string,
  ): Promise<void> {
    const clash = await this.prisma.tenant.findFirst({
      where: {
        slug,
        NOT: { tenantId: currentTenantId },
      },
      select: { tenantId: true },
    });

    if (clash) {
      throw new ConflictException('Slug is already in use');
    }
  }

  private parsePayload(value: Prisma.JsonValue): TenantChangePayload {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    const record = value as Record<string, unknown>;
    const payload: TenantChangePayload = {};

    if (typeof record.slug === 'string' && record.slug.length > 0) {
      payload.slug = record.slug;
    }

    if (typeof record.name === 'string' && record.name.length > 0) {
      payload.name = record.name;
    }

    return payload;
  }

  private toResponse(row: ApprovalRequestRecord): ApprovalRequestResponse {
    return {
      publicId: row.publicId,
      entityType: row.entityType,
      payload: this.parsePayload(row.payload),
      previousData: row.previousData
        ? this.parsePayload(row.previousData)
        : null,
      reason: row.reason,
      rejectionReason: row.rejectionReason,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      reviewedAt: row.reviewedAt,
      tenant: {
        uuid: row.tenant.tenantId,
        tenantCode: row.tenant.tenantCode,
        slug: row.tenant.slug,
        name: row.tenant.name,
      },
      requestedBy: {
        userId: row.requestedBy.userId,
        fullname: row.requestedBy.fullname,
        email: row.requestedBy.email,
      },
      reviewedBy: row.reviewedBy
        ? {
            userId: row.reviewedBy.userId,
            fullname: row.reviewedBy.fullname,
            email: row.reviewedBy.email,
          }
        : null,
    };
  }
}
