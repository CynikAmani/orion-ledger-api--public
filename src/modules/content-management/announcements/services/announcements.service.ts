import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuditContext } from '../../../../core/audit/interfaces/audit-payload.interface';
import { AuditEmitterService } from '../../../../core/audit/services/audit-emitter.service';
import { PrismaService } from '../../../../core/database/prisma.service';
import { ANNOUNCEMENT_AUDIT_ACTIONS } from '../constants/announcement-audit-actions.constant';
import {
  resolveAnnouncementLifecycle,
  type AnnouncementLifecycleStatus,
  type AnnouncementListStatus,
} from '../constants/announcement-lifecycle.constant';
import { CreateAnnouncementDto } from '../dto/create-announcement.dto';
import { ListAnnouncementsQueryDto } from '../dto/list-announcements-query.dto';
import { UpdateAnnouncementDto } from '../dto/update-announcement.dto';
import { announcementVisibilityWhere } from '../utils/announcement-visibility-where.util';

const ANNOUNCEMENT_SELECT = {
  id: true,
  title: true,
  content: true,
  linkUrl: true,
  startsAt: true,
  endsAt: true,
} as const;

type AnnouncementRecord = Prisma.GlobalAnnouncementGetPayload<{
  select: typeof ANNOUNCEMENT_SELECT;
}>;

export interface AnnouncementResponse {
  id: number;
  title: string;
  content: string;
  linkUrl: string | null;
  startsAt: Date;
  endsAt: Date;
  status: AnnouncementLifecycleStatus;
}

export interface DismissAnnouncementResponse {
  success: true;
}

@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditEmitter: AuditEmitterService,
  ) {}

  async create(
    tenantId: string,
    dto: CreateAnnouncementDto,
    auditContext: AuditContext,
  ): Promise<AnnouncementResponse> {
    this.assertValidDateRange(dto.startsAt, dto.endsAt);

    const announcement = await this.prisma.globalAnnouncement.create({
      data: {
        tenantId,
        title: dto.title,
        content: dto.content,
        linkUrl: dto.linkUrl,
        startsAt: dto.startsAt,
        endsAt: dto.endsAt,
      },
      select: ANNOUNCEMENT_SELECT,
    });

    this.emitAudit(tenantId, auditContext, {
      action: ANNOUNCEMENT_AUDIT_ACTIONS.CREATED,
      targetId: String(announcement.id),
      payload: {
        title: dto.title,
        startsAt: dto.startsAt.toISOString(),
        endsAt: dto.endsAt.toISOString(),
        linkUrl: dto.linkUrl ?? null,
      },
    });

    return this.toResponse(announcement);
  }

  async findAll(
    tenantId: string,
    query: ListAnnouncementsQueryDto,
  ): Promise<AnnouncementResponse[]> {
    const now = new Date();
    const listWhere = this.buildListWhere(query.status, now);
    const where: Prisma.GlobalAnnouncementWhereInput = {
      tenantId,
      ...(listWhere ?? {}),
    };

    const announcements = await this.prisma.globalAnnouncement.findMany({
      where,
      select: ANNOUNCEMENT_SELECT,
      orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
    });

    return announcements.map((announcement) =>
      this.toResponse(announcement, now),
    );
  }

  async findOne(
    tenantId: string,
    id: number,
  ): Promise<AnnouncementResponse> {
    return this.toResponse(await this.assertAnnouncementExists(tenantId, id));
  }

  async findPublic(tenantId: string): Promise<AnnouncementResponse[]> {
    const now = new Date();

    const announcements = await this.prisma.globalAnnouncement.findMany({
      where: {
        tenantId,
        ...this.runningWindowWhere(now),
      },
      select: ANNOUNCEMENT_SELECT,
      orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
    });

    return announcements.map((announcement) =>
      this.toResponse(announcement, now),
    );
  }

  async findVisibleForUser(
    userId: number,
    tenantId: string | null,
  ): Promise<AnnouncementResponse[]> {
    const now = new Date();

    const announcements = await this.prisma.globalAnnouncement.findMany({
      where: {
        ...announcementVisibilityWhere(tenantId),
        ...this.runningWindowWhere(now),
        announcementDismissals: {
          none: { userId },
        },
      },
      select: ANNOUNCEMENT_SELECT,
      orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
    });

    return announcements.map((announcement) =>
      this.toResponse(announcement, now),
    );
  }

  async dismiss(
    userId: number,
    announcementId: number,
    auditContext: AuditContext,
    tenantId: string | null,
  ): Promise<DismissAnnouncementResponse> {
    const visible = await this.prisma.globalAnnouncement.findFirst({
      where: {
        id: announcementId,
        ...announcementVisibilityWhere(tenantId),
      },
      select: { id: true, tenantId: true },
    });

    if (!visible) {
      throw new NotFoundException(
        `Announcement with ID ${announcementId} not found`,
      );
    }

    await this.prisma.userAnnouncementDismissal.upsert({
      where: {
        userId_announcementId: {
          userId,
          announcementId,
        },
      },
      update: {},
      create: {
        userId,
        announcementId,
      },
    });

    this.emitAudit(visible.tenantId, auditContext, {
      action: ANNOUNCEMENT_AUDIT_ACTIONS.DISMISSED,
      targetId: String(announcementId),
      payload: { userId },
    });

    return { success: true };
  }

  async update(
    tenantId: string,
    announcementId: number,
    dto: UpdateAnnouncementDto,
    auditContext: AuditContext,
  ): Promise<AnnouncementResponse> {
    const existing = await this.assertAnnouncementExists(
      tenantId,
      announcementId,
    );

    const startsAt = dto.startsAt ?? existing.startsAt;
    const endsAt = dto.endsAt ?? existing.endsAt;
    this.assertValidDateRange(startsAt, endsAt);

    const announcement = await this.prisma.globalAnnouncement.update({
      where: {
        id_tenantId: {
          id: announcementId,
          tenantId,
        },
      },
      data: {
        title: dto.title,
        content: dto.content,
        linkUrl: dto.linkUrl,
        startsAt: dto.startsAt,
        endsAt: dto.endsAt,
      },
      select: ANNOUNCEMENT_SELECT,
    });

    this.emitAudit(tenantId, auditContext, {
      action: ANNOUNCEMENT_AUDIT_ACTIONS.UPDATED,
      targetId: String(announcementId),
      payload: {
        title: dto.title,
        content: dto.content,
        linkUrl: dto.linkUrl,
        startsAt: dto.startsAt?.toISOString(),
        endsAt: dto.endsAt?.toISOString(),
      },
    });

    return this.toResponse(announcement);
  }

  async remove(
    tenantId: string,
    announcementId: number,
    auditContext: AuditContext,
  ): Promise<void> {
    const existing = await this.assertAnnouncementExists(
      tenantId,
      announcementId,
    );

    await this.prisma.globalAnnouncement.delete({
      where: {
        id_tenantId: {
          id: announcementId,
          tenantId,
        },
      },
    });

    this.emitAudit(tenantId, auditContext, {
      action: ANNOUNCEMENT_AUDIT_ACTIONS.DELETED,
      targetId: String(announcementId),
      payload: { title: existing.title },
    });
  }

  private runningWindowWhere(
    now: Date,
  ): Prisma.GlobalAnnouncementWhereInput {
    return {
      startsAt: { lte: now },
      endsAt: { gte: now },
    };
  }

  private buildListWhere(
    status: AnnouncementListStatus | undefined,
    now: Date,
  ): Prisma.GlobalAnnouncementWhereInput | undefined {
    if (status === 'upcoming') {
      return { startsAt: { gt: now } };
    }

    if (status === 'running') {
      return this.runningWindowWhere(now);
    }

    if (status === 'expired') {
      return { endsAt: { lt: now } };
    }

    return undefined;
  }

  private assertValidDateRange(startsAt: Date, endsAt: Date): void {
    if (endsAt.getTime() <= startsAt.getTime()) {
      throw new BadRequestException('endsAt must be after startsAt');
    }
  }

  private async assertAnnouncementExists(
    tenantId: string,
    announcementId: number,
  ): Promise<AnnouncementRecord> {
    const announcement = await this.prisma.globalAnnouncement.findUnique({
      where: {
        id_tenantId: {
          id: announcementId,
          tenantId,
        },
      },
      select: ANNOUNCEMENT_SELECT,
    });

    if (!announcement) {
      throw new NotFoundException(
        `Announcement with ID ${announcementId} not found`,
      );
    }

    return announcement;
  }

  private toResponse(
    announcement: AnnouncementRecord,
    now: Date = new Date(),
  ): AnnouncementResponse {
    return {
      ...announcement,
      status: resolveAnnouncementLifecycle(
        announcement.startsAt,
        announcement.endsAt,
        now,
      ),
    };
  }

  private emitAudit(
    tenantId: string | null,
    auditContext: AuditContext,
    params: {
      action: string;
      targetId?: string;
      payload?: Record<string, unknown>;
    },
  ): void {
    this.auditEmitter.emit({
      ...auditContext,
      tenantId,
      module: 'CONTENT_MANAGEMENT',
      targetType: 'GlobalAnnouncement',
      ...params,
    });
  }
}