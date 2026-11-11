import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { GetAuditLogsQueryDto } from '../dto/get-audit-logs-query.dto';
import type { GetPlatformAuditLogsQueryDto } from '../dto/get-platform-audit-logs-query.dto';

export function buildTenantAuditLogWhere(
  tenantId: string,
  query: GetAuditLogsQueryDto,
): Prisma.AuditLogWhereInput {
  return {
    tenantId,
    ...buildAuditLogAttributeWhere(query),
  };
}

export function buildPlatformAuditLogWhere(
  query: GetPlatformAuditLogsQueryDto,
): Prisma.AuditLogWhereInput {
  const tenantId = query.tenantId?.trim();

  return {
    ...(tenantId
      ? { tenantId }
      : { OR: [{ tenantId: null }, { module: 'PLATFORM' }] }),
    ...buildAuditLogAttributeWhere(query),
  };
}

function buildAuditLogAttributeWhere(
  query: GetAuditLogsQueryDto,
): Prisma.AuditLogWhereInput {
  const createdAt = buildCreatedAtFilter(query.startDate, query.endDate);

  return {
    ...(query.targetId ? { targetId: query.targetId } : {}),
    ...(query.targetType ? { targetType: query.targetType } : {}),
    ...(query.userId ? { user: { userId: query.userId } } : {}),
    ...(query.action ? { action: query.action } : {}),
    ...(query.modules?.length ? { module: { in: query.modules } } : {}),
    ...(createdAt ? { createdAt } : {}),
  };
}

function buildCreatedAtFilter(
  startDate?: string,
  endDate?: string,
): Prisma.DateTimeFilter | undefined {
  if (!startDate && !endDate) {
    return undefined;
  }

  const gte = startDate ? new Date(startDate) : undefined;
  const lte = endDate ? new Date(endDate) : undefined;

  if (gte && lte && lte < gte) {
    throw new BadRequestException(
      'endDate must be greater than or equal to startDate',
    );
  }

  return {
    ...(gte ? { gte } : {}),
    ...(lte ? { lte } : {}),
  };
}
