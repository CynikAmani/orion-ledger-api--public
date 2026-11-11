import { Injectable, NotFoundException } from '@nestjs/common';
import { AdvertPlacement, AdvertStatus, Prisma } from '@prisma/client';
import type { AuditContext } from '../../../../core/audit/interfaces/audit-payload.interface';
import { AuditEmitterService } from '../../../../core/audit/services/audit-emitter.service';
import { PrismaService } from '../../../../core/database/prisma.service';
import { UPLOAD_DIRS } from '../../../../core/storage/constants/upload-dirs.constant';
import { ImageStorageService } from '../../../../core/storage/services/image-storage.service';
import { ADVERT_AUDIT_ACTIONS } from '../constants/advert-audit-actions.constant';
import { CreateAdvertDto } from '../dto/create-advert.dto';
import { ListAdvertsQueryDto } from '../dto/list-adverts-query.dto';
import { UpdateAdvertDto } from '../dto/update-advert.dto';
import { UpdateAdvertStatusDto } from '../dto/update-advert-status.dto';

const ADVERT_SELECT = {
  id: true,
  title: true,
  content: true,
  imageUrl: true,
  placement: true,
  status: true,
  endDate: true,
  createdAt: true,
  updatedAt: true,
} as const;

export interface AdvertResponse {
  id: number;
  title: string;
  content: string;
  imageUrl: string | null;
  placement: AdvertPlacement;
  status: AdvertStatus;
  endDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class AdvertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditEmitter: AuditEmitterService,
    private readonly imageStorage: ImageStorageService,
  ) {}

  async create(
    tenantId: string,
    dto: CreateAdvertDto,
    auditContext: AuditContext,
    file?: Express.Multer.File,
  ): Promise<AdvertResponse> {
    const imageUrl = file
      ? await this.imageStorage.save(file, UPLOAD_DIRS.ADVERTS)
      : null;

    try {
      const advert = await this.prisma.advert.create({
        data: {
          tenantId,
          title: dto.title,
          content: dto.content,
          placement: dto.placement,
          status: dto.status,
          endDate: dto.endDate,
          imageUrl,
        },
        select: ADVERT_SELECT,
      });

      this.emitAudit(tenantId, auditContext, {
        action: ADVERT_AUDIT_ACTIONS.CREATED,
        targetId: String(advert.id),
        payload: { ...dto, imageUrl },
      });

      return advert;
    } catch (error) {
      await this.imageStorage.deleteIfExists(imageUrl);
      throw error;
    }
  }

  async findAll(
    tenantId: string,
    query: ListAdvertsQueryDto,
  ): Promise<AdvertResponse[]> {
    const where: Prisma.AdvertWhereInput = { tenantId };

    if (query.status !== undefined) {
      where.status = query.status;
    }

    if (query.placement !== undefined) {
      where.placement = query.placement;
    }

    return this.prisma.advert.findMany({
      where,
      select: ADVERT_SELECT,
      orderBy: { id: 'desc' },
    });
  }

  async findOne(tenantId: string, id: number): Promise<AdvertResponse> {
    return this.assertAdvertExists(tenantId, id);
  }

  findPublic(tenantId: string): Promise<AdvertResponse[]> {
    const now = new Date();

    return this.prisma.advert.findMany({
      where: {
        tenantId,
        status: AdvertStatus.ACTIVE,
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
      select: ADVERT_SELECT,
      orderBy: { id: 'desc' },
    });
  }

  async update(
    tenantId: string,
    id: number,
    dto: UpdateAdvertDto,
    auditContext: AuditContext,
    file?: Express.Multer.File,
  ): Promise<AdvertResponse> {
    const existing = await this.assertAdvertExists(tenantId, id);
    const imageUrl = file
      ? await this.imageStorage.save(file, UPLOAD_DIRS.ADVERTS)
      : undefined;

    try {
      const advert = await this.prisma.advert.update({
        where: {
          id_tenantId: {
            id,
            tenantId,
          },
        },
        data: {
          title: dto.title,
          content: dto.content,
          placement: dto.placement,
          endDate: dto.endDate,
          ...(imageUrl !== undefined ? { imageUrl } : {}),
        },
        select: ADVERT_SELECT,
      });

      if (imageUrl !== undefined) {
        await this.imageStorage.deleteIfExists(existing.imageUrl);
      }

      this.emitAudit(tenantId, auditContext, {
        action: ADVERT_AUDIT_ACTIONS.UPDATED,
        targetId: String(id),
        payload: {
          ...dto,
          ...(imageUrl !== undefined
            ? { imageUrl, previousImageUrl: existing.imageUrl }
            : {}),
        },
      });

      return advert;
    } catch (error) {
      await this.imageStorage.deleteIfExists(imageUrl);
      throw error;
    }
  }

  async updateStatus(
    tenantId: string,
    id: number,
    dto: UpdateAdvertStatusDto,
    auditContext: AuditContext,
  ): Promise<AdvertResponse> {
    await this.assertAdvertExists(tenantId, id);

    const advert = await this.prisma.advert.update({
      where: {
        id_tenantId: {
          id,
          tenantId,
        },
      },
      data: { status: dto.status },
      select: ADVERT_SELECT,
    });

    this.emitAudit(tenantId, auditContext, {
      action: ADVERT_AUDIT_ACTIONS.UPDATED,
      targetId: String(id),
      payload: { operation: 'status-transition', status: dto.status },
    });

    return advert;
  }

  async remove(
    tenantId: string,
    id: number,
    auditContext: AuditContext,
  ): Promise<void> {
    const existing = await this.assertAdvertExists(tenantId, id);

    await this.prisma.advert.delete({
      where: {
        id_tenantId: {
          id,
          tenantId,
        },
      },
    });

    await this.imageStorage.deleteIfExists(existing.imageUrl);

    this.emitAudit(tenantId, auditContext, {
      action: ADVERT_AUDIT_ACTIONS.DELETED,
      targetId: String(id),
      payload: { title: existing.title },
    });
  }

  private emitAudit(
    tenantId: string,
    auditContext: AuditContext,
    params: {
      action: string;
      targetId?: string;
      targetType?: string;
      payload?: Record<string, unknown>;
    },
  ): void {
    this.auditEmitter.emit({
      ...auditContext,
      tenantId,
      module: 'CONTENT_MANAGEMENT',
      targetType: params.targetType ?? 'Advert',
      ...params,
    });
  }

  private async assertAdvertExists(
    tenantId: string,
    id: number,
  ): Promise<AdvertResponse> {
    const advert = await this.prisma.advert.findUnique({
      where: {
        id_tenantId: {
          id,
          tenantId,
        },
      },
      select: ADVERT_SELECT,
    });

    if (!advert) {
      throw new NotFoundException(`Advert with ID ${id} not found`);
    }

    return advert;
  }
}