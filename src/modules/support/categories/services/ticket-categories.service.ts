import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TicketCategoryScope } from '@prisma/client';
import type { AuditContext } from '../../../../core/audit/interfaces/audit-payload.interface';
import { AuditEmitterService } from '../../../../core/audit/services/audit-emitter.service';
import { PrismaService } from '../../../../core/database/prisma.service';
import { CATEGORY_AUDIT_ACTIONS } from '../constants/category-audit-actions.constant';
import { CreateTicketCategoryDto } from '../dto/create-ticket-category.dto';
import { ListTicketCategoriesQueryDto } from '../dto/list-ticket-categories-query.dto';
import { UpdateTicketCategoryDto } from '../dto/update-ticket-category.dto';

const TICKET_CATEGORY_SELECT = {
  id: true,
  key: true,
  name: true,
  description: true,
  scope: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

export interface TicketCategoryResponse {
  id: number;
  key: string;
  name: string;
  description: string | null;
  /** PLATFORM = contact Orion; TENANT = contact a specific institution. */
  scope: TicketCategoryScope;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class TicketCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditEmitter: AuditEmitterService,
  ) {}

  async create(
    dto: CreateTicketCategoryDto,
    auditContext: AuditContext,
  ): Promise<TicketCategoryResponse> {
    const category = await this.prisma.ticketCategory.create({
      data: {
        key: dto.key,
        name: dto.name,
        description: dto.description,
        scope: dto.scope ?? TicketCategoryScope.PLATFORM,
        isActive: dto.isActive ?? true,
      },
      select: TICKET_CATEGORY_SELECT,
    });

    this.emitAudit(auditContext, {
      action: CATEGORY_AUDIT_ACTIONS.CREATED,
      targetId: String(category.id),
      payload: { ...dto },
    });

    return category;
  }

  async findAll(
    query: ListTicketCategoriesQueryDto,
  ): Promise<TicketCategoryResponse[]> {
    const where: Prisma.TicketCategoryWhereInput = {};

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.scope !== undefined) {
      where.scope = query.scope;
    }

    return this.prisma.ticketCategory.findMany({
      where,
      select: TICKET_CATEGORY_SELECT,
      orderBy: { name: 'asc' },
    });
  }

  async findActive(
    scope?: TicketCategoryScope,
  ): Promise<TicketCategoryResponse[]> {
    return this.prisma.ticketCategory.findMany({
      where: {
        isActive: true,
        ...(scope !== undefined ? { scope } : {}),
      },
      select: TICKET_CATEGORY_SELECT,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: number): Promise<TicketCategoryResponse> {
    return this.assertCategoryExists(id);
  }

  async update(
    id: number,
    dto: UpdateTicketCategoryDto,
    auditContext: AuditContext,
  ): Promise<TicketCategoryResponse> {
    await this.assertCategoryExists(id);

    const category = await this.prisma.ticketCategory.update({
      where: { id },
      data: dto,
      select: TICKET_CATEGORY_SELECT,
    });

    this.emitAudit(auditContext, {
      action: CATEGORY_AUDIT_ACTIONS.UPDATED,
      targetId: String(id),
      payload: { ...dto },
    });

    return category;
  }

  async remove(id: number, auditContext: AuditContext): Promise<void> {
    const existing = await this.assertCategoryExists(id);

    await this.prisma.ticketCategory.delete({
      where: { id },
    });

    this.emitAudit(auditContext, {
      action: CATEGORY_AUDIT_ACTIONS.DELETED,
      targetId: String(id),
      payload: { key: existing.key, name: existing.name },
    });
  }

  async assertActiveCategoryExists(id: number): Promise<TicketCategoryResponse> {
    const category = await this.prisma.ticketCategory.findFirst({
      where: { id, isActive: true },
      select: TICKET_CATEGORY_SELECT,
    });

    if (!category) {
      throw new NotFoundException(
        `Active ticket category with ID ${id} not found`,
      );
    }

    return category;
  }

  private emitAudit(
    auditContext: AuditContext,
    params: {
      action: string;
      targetId: string;
      payload?: Record<string, unknown>;
    },
  ): void {
    this.auditEmitter.emit({
      ...auditContext,
      module: 'SUPPORT',
      targetType: 'TicketCategory',
      ...params,
    });
  }

  private async assertCategoryExists(
    id: number,
  ): Promise<TicketCategoryResponse> {
    const category = await this.prisma.ticketCategory.findUnique({
      where: { id },
      select: TICKET_CATEGORY_SELECT,
    });

    if (!category) {
      throw new NotFoundException(`Ticket category with ID ${id} not found`);
    }

    return category;
  }
}
