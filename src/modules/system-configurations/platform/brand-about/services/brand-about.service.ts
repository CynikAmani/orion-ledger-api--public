import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuditContext } from '../../../../../core/audit/interfaces/audit-payload.interface';
import { AuditEmitterService } from '../../../../../core/audit/services/audit-emitter.service';
import { PrismaService } from '../../../../../core/database/prisma.service';
import { CreateBrandAboutDto } from '../dto/create-brand-about.dto';
import { UpdateBrandAboutDto } from '../dto/update-brand-about.dto';

const BRAND_ABOUT_SELECT = {
  brandMission: true,
  brandVision: true,
  contactPhone: true,
  whatsappPhone: true,
  contactEmail: true,
  coreValues: true,
} as const;

export interface BrandAboutResponse {
  brandMission: string | null;
  brandVision: string | null;
  contactPhone: string | null;
  whatsappPhone: string | null;
  contactEmail: string | null;
  coreValues: string | null;
}

/** Orion platform contact channels for tenant-facing manual-payment UX. */
export interface PlatformContactDetails {
  contactPhone: string | null;
  whatsappPhone: string | null;
  contactEmail: string | null;
}

export interface CreateBrandAboutResponse {
  success: true;
  brandMission: string | null;
  brandVision: string | null;
  contactPhone: string | null;
  whatsappPhone: string | null;
  contactEmail: string | null;
  coreValues: string | null;
}

export interface UpdateBrandAboutResponse {
  success: true;
  brandMission: string | null;
  brandVision: string | null;
  contactPhone: string | null;
  whatsappPhone: string | null;
  contactEmail: string | null;
  coreValues: string | null;
}

@Injectable()
export class BrandAboutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditEmitter: AuditEmitterService,
  ) {}

  async getAboutDetails(): Promise<BrandAboutResponse> {
    const about = await this.prisma.about.findFirst({
      select: BRAND_ABOUT_SELECT,
    });

    return {
      brandMission: about?.brandMission ?? null,
      brandVision: about?.brandVision ?? null,
      contactPhone: about?.contactPhone ?? null,
      whatsappPhone: about?.whatsappPhone ?? null,
      contactEmail: about?.contactEmail ?? null,
      coreValues: about?.coreValues ?? null,
    };
  }

  async getPlatformContact(): Promise<PlatformContactDetails> {
    const about = await this.prisma.about.findFirst({
      select: {
        contactPhone: true,
        whatsappPhone: true,
        contactEmail: true,
      },
    });

    return {
      contactPhone: about?.contactPhone ?? null,
      whatsappPhone: about?.whatsappPhone ?? null,
      contactEmail: about?.contactEmail ?? null,
    };
  }

  async createAboutDetails(
    dto: CreateBrandAboutDto,
    auditContext: AuditContext,
  ): Promise<CreateBrandAboutResponse> {
    const existing = await this.prisma.about.findFirst({
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Brand about details already exist');
    }

    const about = await this.prisma.about.create({
      data: dto,
      select: { id: true, ...BRAND_ABOUT_SELECT },
    });

    this.emitAudit(auditContext, {
      action: 'BRAND_ABOUT_CREATED',
      targetId: String(about.id),
      payload: { ...dto },
    });

    return {
      success: true,
      brandMission: about.brandMission,
      brandVision: about.brandVision,
      contactPhone: about.contactPhone,
      whatsappPhone: about.whatsappPhone,
      contactEmail: about.contactEmail,
      coreValues: about.coreValues,
    };
  }

  async updateAboutDetails(
    dto: UpdateBrandAboutDto,
    auditContext: AuditContext,
  ): Promise<UpdateBrandAboutResponse> {
    const existing = await this.prisma.about.findFirst({
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Brand about details not found');
    }

    const about = await this.prisma.about.update({
      where: { id: existing.id },
      data: dto,
      select: BRAND_ABOUT_SELECT,
    });

    this.emitAudit(auditContext, {
      action: 'BRAND_ABOUT_UPDATED',
      targetId: String(existing.id),
      payload: { ...dto },
    });

    return {
      success: true,
      ...about,
    };
  }

  private emitAudit(
    auditContext: AuditContext,
    params: { action: string; targetId: string; payload?: Record<string, unknown> },
  ): void {
    this.auditEmitter.emit({
      ...auditContext,
      module: 'SYSTEM_CONFIGURATIONS',
      targetType: 'BrandAbout',
      ...params,
    });
  }
}
