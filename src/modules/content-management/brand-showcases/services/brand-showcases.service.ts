import { Injectable, NotFoundException } from '@nestjs/common';
import { AssetCategory, Prisma } from '@prisma/client';
import type { AuditContext } from '../../../../core/audit/interfaces/audit-payload.interface';
import { AuditEmitterService } from '../../../../core/audit/services/audit-emitter.service';
import { PrismaService } from '../../../../core/database/prisma.service';
import { UPLOAD_DIRS } from '../../../../core/storage/constants/upload-dirs.constant';
import { ImageStorageService } from '../../../../core/storage/services/image-storage.service';
import { BRAND_SHOWCASE_AUDIT_ACTIONS } from '../constants/brand-showcase-audit-actions.constant';
import { CreateBrandShowcaseDto } from '../dto/create-brand-showcase.dto';
import { ListBrandShowcasesQueryDto } from '../dto/list-brand-showcases-query.dto';
import { UpdateBrandShowcaseDto } from '../dto/update-brand-showcase.dto';

const BRAND_SHOWCASE_SELECT = {
  id: true,
  title: true,
  description: true,
  imageUrl: true,
  category: true,
  isPublished: true,
  createdAt: true,
  updatedAt: true,
} as const;

export interface BrandShowcaseResponse {
  id: number;
  title: string;
  description: string | null;
  imageUrl: string | null;
  category: AssetCategory;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class BrandShowcasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditEmitter: AuditEmitterService,
    private readonly imageStorage: ImageStorageService,
  ) { }

  async create(
    tenantId: string,
    dto: CreateBrandShowcaseDto,
    auditContext: AuditContext,
    file?: Express.Multer.File,
  ): Promise<BrandShowcaseResponse> {
    const imageUrl = file
      ? await this.imageStorage.save(file, UPLOAD_DIRS.BRAND_SHOWCASES)
      : null;

    try {
      const showcase = await this.prisma.brandShowcase.create({
        data: {
          tenantId,
          title: dto.title,
          description: dto.description,
          category: dto.category,
          isPublished: dto.isPublished,
          imageUrl,
        },
        select: BRAND_SHOWCASE_SELECT,
      });

      this.emitAudit(tenantId, auditContext, {
        action: BRAND_SHOWCASE_AUDIT_ACTIONS.CREATED,
        targetId: String(showcase.id),
        payload: { ...dto, imageUrl },
      });

      return showcase;
    } catch (error) {
      await this.imageStorage.deleteIfExists(imageUrl);
      throw error;
    }
  }

  async findAll(
    tenantId: string,
    query: ListBrandShowcasesQueryDto,
  ): Promise<BrandShowcaseResponse[]> {
    const where: Prisma.BrandShowcaseWhereInput = { tenantId };

    if (query.category !== undefined) {
      where.category = query.category;
    }

    if (query.isPublished !== undefined) {
      where.isPublished = query.isPublished;
    }

    return this.prisma.brandShowcase.findMany({
      where,
      select: BRAND_SHOWCASE_SELECT,
      orderBy: { id: 'asc' },
    });
  }

  async findOne(tenantId: string, id: number): Promise<BrandShowcaseResponse> {
    return this.assertBrandShowcaseExists(tenantId, id);
  }

  findPublic(tenantId: string): Promise<BrandShowcaseResponse[]> {
    return this.prisma.brandShowcase.findMany({
      where: {
        tenantId,
        isPublished: true,
      },
      select: BRAND_SHOWCASE_SELECT,
      orderBy: { id: 'asc' },
    });
  }

  async update(
    tenantId: string,
    id: number,
    dto: UpdateBrandShowcaseDto,
    auditContext: AuditContext,
    file?: Express.Multer.File,
  ): Promise<BrandShowcaseResponse> {
    const existing = await this.assertBrandShowcaseExists(tenantId, id);
    const imageUrl = file
      ? await this.imageStorage.save(file, UPLOAD_DIRS.BRAND_SHOWCASES)
      : undefined;

    try {
      const showcase = await this.prisma.brandShowcase.update({
        where: {
          id_tenantId: {
            id,
            tenantId,
          },
        },
        data: {
          ...dto,
          ...(imageUrl !== undefined ? { imageUrl } : {}),
        },
        select: BRAND_SHOWCASE_SELECT,
      });

      if (imageUrl !== undefined) {
        await this.imageStorage.deleteIfExists(existing.imageUrl);
      }

      this.emitAudit(tenantId, auditContext, {
        action: BRAND_SHOWCASE_AUDIT_ACTIONS.UPDATED,
        targetId: String(id),
        payload: {
          ...dto,
          ...(imageUrl !== undefined
            ? { imageUrl, previousImageUrl: existing.imageUrl }
            : {}),
        },
      });

      return showcase;
    } catch (error) {
      await this.imageStorage.deleteIfExists(imageUrl);
      throw error;
    }
  }

  async remove(
    tenantId: string,
    id: number,
    auditContext: AuditContext,
  ): Promise<void> {
    const existing = await this.assertBrandShowcaseExists(tenantId, id);

    await this.prisma.brandShowcase.delete({
      where: {
        id_tenantId: {
          id,
          tenantId,
        },
      },
    });

    await this.imageStorage.deleteIfExists(existing.imageUrl);

    this.emitAudit(tenantId, auditContext, {
      action: BRAND_SHOWCASE_AUDIT_ACTIONS.DELETED,
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
      payload?: Record<string, unknown>;
    },
  ): void {
    this.auditEmitter.emit({
      ...auditContext,
      tenantId,
      module: 'CONTENT_MANAGEMENT',
      targetType: 'BrandShowcase',
      ...params,
    });
  }

  private async assertBrandShowcaseExists(
    tenantId: string,
    id: number,
  ): Promise<BrandShowcaseResponse> {
    const showcase = await this.prisma.brandShowcase.findUnique({
      where: {
        id_tenantId: {
          id,
          tenantId,
        },
      },
      select: BRAND_SHOWCASE_SELECT,
    });

    if (!showcase) {
      throw new NotFoundException(`Brand showcase with ID ${id} not found`);
    }

    return showcase;
  }
}