import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  AUDIT_REDACTED_VALUE,
  isSensitiveAuditKey,
} from '../constants/audit-display.constant';
import type { GetAuditLogsQueryDto } from '../dto/get-audit-logs-query.dto';
import type { GetPlatformAuditLogsQueryDto } from '../dto/get-platform-audit-logs-query.dto';
import type { AuditPayload } from '../interfaces/audit-payload.interface';
import {
  buildPlatformAuditLogWhere,
  buildTenantAuditLogWhere,
} from '../utils/build-audit-log-where.util';
import { normalizeAuditPayload } from '../utils/normalize-audit-payload.util';

export interface AuditLogResponse {
  id: string;
  tenantId: string | null;
  userId: string | null;
  userEmail: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  module: string;
  action: string;
  targetId: string | null;
  targetType: string | null;
  payload: Prisma.JsonValue;
  createdAt: Date;
}

export interface AuditLogsListResponse {
  success: true;
  data: AuditLogResponse[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(payload: AuditPayload): Promise<void> {
    const normalizedPayload = normalizeAuditPayload(
      payload.payload,
      payload.action,
    );

    await this.prisma.auditLog.create({
      data: {
        tenantId: payload.tenantId ?? undefined,
        userId: payload.userId,
        userEmail: payload.userEmail,
        ipAddress: payload.ipAddress,
        userAgent: payload.userAgent,
        module: payload.module,
        action: payload.action,
        targetId: payload.targetId,
        targetType: payload.targetType,
        payload: this.sanitizePayload(
          normalizedPayload,
        ) as Prisma.InputJsonValue,
      },
    });
  }

  async findForTenant(
    tenantId: string,
    query: GetAuditLogsQueryDto,
  ): Promise<AuditLogsListResponse> {
    return this.findPage(
      buildTenantAuditLogWhere(tenantId, query),
      query.page ?? 1,
      query.limit ?? 20,
    );
  }

  async findForPlatform(
    query: GetPlatformAuditLogsQueryDto,
  ): Promise<AuditLogsListResponse> {
    return this.findPage(
      buildPlatformAuditLogWhere(query),
      query.page ?? 1,
      query.limit ?? 20,
    );
  }

  private async findPage(
    where: Prisma.AuditLogWhereInput,
    page: number,
    limit: number,
  ): Promise<AuditLogsListResponse> {
    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { user: { select: { userId: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      success: true,
      data: rows.map((row) => ({
        id: row.id,
        tenantId: row.tenantId,
        userId: row.user?.userId ?? null,
        userEmail: row.userEmail,
        ipAddress: row.ipAddress,
        userAgent: row.userAgent,
        module: row.module,
        action: row.action,
        targetId: row.targetId,
        targetType: row.targetType,
        payload: row.payload,
        createdAt: row.createdAt,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  private sanitizePayload(data: unknown): unknown {
    if (data === null || data === undefined) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizePayload(item));
    }

    if (typeof data === 'object') {
      const result: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(data)) {
        result[key] = isSensitiveAuditKey(key)
          ? AUDIT_REDACTED_VALUE
          : this.sanitizePayload(value);
      }

      return result;
    }

    return data;
  }
}
