import {
  BadRequestException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AgreementStatus, AgreementType, Prisma } from '@prisma/client';
import {
  APP_ERROR_CODES,
  appHttpException,
} from '../../../../../common/exceptions/app-http.exception';
import type { AuditContext } from '../../../../../core/audit/interfaces/audit-payload.interface';
import { AuditEmitterService } from '../../../../../core/audit/services/audit-emitter.service';
import { PrismaService } from '../../../../../core/database/prisma.service';
import { NOTIFICATION_ACTIONS } from '../../../../../core/notifications/constants/notification-action-keys.constant';
import { NotificationDispatcherService } from '../../../../../core/notifications/services/notification-dispatcher.service';
import { ANNOUNCEMENT_AUDIT_ACTIONS } from '../../../../content-management/announcements/constants/announcement-audit-actions.constant';
import { AGREEMENT_AUDIT_ACTIONS } from '../constants/agreement-audit-actions.constant';
import {
  agreementAnnouncementWindow,
  buildAgreementAnnouncement,
} from '../constants/agreement-announcement.constant';
import {
  canPublishAgreement,
  isAllowedAgreementStatusTransition,
} from '../constants/agreement-status.constant';
import { CreateAgreementDto } from '../dto/create-agreement.dto';
import { ListAgreementsQueryDto } from '../dto/list-agreements-query.dto';
import { UpdateAgreementDto } from '../dto/update-agreement.dto';
import { UpdateAgreementStatusDto } from '../dto/update-agreement-status.dto';

const AGREEMENT_SELECT = {
  id: true,
  version: true,
  title: true,
  content: true,
  type: true,
  status: true,
  effectiveDate: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Platform catalog rows only — never tenant-scoped T&C. */
const PLATFORM_AGREEMENT_SCOPE = {
  tenantId: null,
} as const satisfies Prisma.TermsAndConditionsWhereInput;

type AgreementRecord = Prisma.TermsAndConditionsGetPayload<{
  select: typeof AGREEMENT_SELECT;
}>;

export interface AgreementResponse {
  id: number;
  version: string;
  title: string;
  content: string;
  type: AgreementType;
  status: AgreementStatus;
  effectiveDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicAgreementsResponse {
  termsOfService: AgreementResponse | null;
  privacyPolicy: AgreementResponse | null;
}

export interface UserAgreementStatusItem {
  id: number;
  version: string;
  title: string;
  type: AgreementType;
  accepted: boolean;
  acceptedAt: Date | null;
}

export interface UserAgreementStatusResponse {
  termsOfService: UserAgreementStatusItem | null;
  privacyPolicy: UserAgreementStatusItem | null;
  requiresAcceptance: boolean;
}

export interface AcceptedAgreementItem {
  termsAndConditionsId: number;
  acceptedAt: Date;
}

export interface AcceptAgreementResponse extends AcceptedAgreementItem {
  success: true;
}

export interface AcceptAgreementsResponse {
  success: true;
  accepted: AcceptedAgreementItem[];
}

@Injectable()
export class TermsAndConditionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditEmitter: AuditEmitterService,
    private readonly notificationDispatcher: NotificationDispatcherService,
  ) {}

  async create(
    dto: CreateAgreementDto,
    auditContext: AuditContext,
  ): Promise<AgreementResponse> {
    const agreement = await this.prisma.termsAndConditions.create({
      data: {
        version: dto.version,
        title: dto.title,
        content: dto.content,
        type: dto.type,
        effectiveDate: dto.effectiveDate,
        status: AgreementStatus.DRAFT,
      },
      select: AGREEMENT_SELECT,
    });

    this.emitAudit(auditContext, {
      action: AGREEMENT_AUDIT_ACTIONS.CREATED,
      targetId: String(agreement.id),
      payload: {
        version: dto.version,
        type: dto.type,
        effectiveDate: dto.effectiveDate.toISOString(),
      },
    });

    this.notifyStaff(
      NOTIFICATION_ACTIONS.AGREEMENTS.CREATED,
      `${this.agreementTypeLabel(agreement.type)} draft created`,
      `A new ${this.agreementTypeLabel(agreement.type)} draft "${agreement.title}" (version ${agreement.version}) was created.`,
      {
        agreementId: agreement.id,
        type: agreement.type,
        version: agreement.version,
        title: agreement.title,
      },
    );

    return agreement;
  }

  async findAll(query: ListAgreementsQueryDto): Promise<AgreementResponse[]> {
    const where: Prisma.TermsAndConditionsWhereInput = {
      ...PLATFORM_AGREEMENT_SCOPE,
    };

    if (query.type !== undefined) {
      where.type = query.type;
    }

    if (query.status !== undefined) {
      where.status = query.status;
    }

    return this.prisma.termsAndConditions.findMany({
      where,
      select: AGREEMENT_SELECT,
      orderBy: [{ effectiveDate: 'desc' }, { id: 'desc' }],
    });
  }

  async findOne(id: number): Promise<AgreementResponse> {
    return this.assertAgreementExists(id);
  }

  findPublic(): Promise<PublicAgreementsResponse> {
    return this.loadPublicAgreements();
  }

  async findPublicByType(
    type: AgreementType,
  ): Promise<AgreementResponse | null> {
    const now = new Date();

    return this.prisma.termsAndConditions.findFirst({
      where: {
        ...PLATFORM_AGREEMENT_SCOPE,
        type,
        ...this.activePublishedWhere(now),
      },
      select: AGREEMENT_SELECT,
      orderBy: [{ effectiveDate: 'desc' }, { id: 'desc' }],
    });
  }

  async getStatusForUser(userId: number): Promise<UserAgreementStatusResponse> {
    const published = await this.loadPublicAgreements();
    const publishedIds = [
      published.termsOfService?.id,
      published.privacyPolicy?.id,
    ].filter((id): id is number => id !== undefined);

    const acceptances =
      publishedIds.length === 0
        ? []
        : await this.prisma.userTncAcceptance.findMany({
            where: {
              userId,
              termsAndConditionsId: { in: publishedIds },
            },
            select: {
              termsAndConditionsId: true,
              acceptedAt: true,
            },
          });

    const acceptedAtByAgreementId = new Map(
      acceptances.map((row) => [row.termsAndConditionsId, row.acceptedAt]),
    );

    const termsOfService = this.toUserStatusItem(
      published.termsOfService,
      acceptedAtByAgreementId,
    );
    const privacyPolicy = this.toUserStatusItem(
      published.privacyPolicy,
      acceptedAtByAgreementId,
    );

    return {
      termsOfService,
      privacyPolicy,
      requiresAcceptance:
        (termsOfService !== null && !termsOfService.accepted) ||
        (privacyPolicy !== null && !privacyPolicy.accepted),
    };
  }

  /**
   * Hard gate for customer business writes (e.g. loan apply).
   * Frontend AuthGuard / modals are UX only — callers must still enforce here.
   */
  async assertCurrentAgreementsAccepted(userId: number): Promise<void> {
    const status = await this.getStatusForUser(userId);

    if (status.requiresAcceptance) {
      throw appHttpException(
        HttpStatus.FORBIDDEN,
        'You must accept the current Terms of Service and Privacy Policy before continuing',
        APP_ERROR_CODES.CUSTOMER_AGREEMENTS_NOT_ACCEPTED,
      );
    }
  }

  async accept(
    userId: number,
    agreementId: number,
    ipAddress: string | undefined,
    auditContext: AuditContext,
  ): Promise<AcceptAgreementResponse>;
  async accept(
    userId: number,
    agreementIds: readonly number[],
    ipAddress: string | undefined,
    auditContext: AuditContext,
  ): Promise<AcceptAgreementsResponse>;
  async accept(
    userId: number,
    agreementIdOrIds: number | readonly number[],
    ipAddress: string | undefined,
    auditContext: AuditContext,
  ): Promise<AcceptAgreementResponse | AcceptAgreementsResponse> {
    const isBatch = Array.isArray(agreementIdOrIds);
    const accepted = await this.acceptActiveAgreements(
      userId,
      this.normalizeAgreementIds(agreementIdOrIds),
      ipAddress,
      auditContext,
    );

    if (!isBatch) {
      const [single] = accepted;
      if (!single) {
        throw new BadRequestException('At least one agreement ID is required');
      }

      return {
        success: true,
        termsAndConditionsId: single.termsAndConditionsId,
        acceptedAt: single.acceptedAt,
      };
    }

    return { success: true, accepted };
  }

  async update(
    id: number,
    dto: UpdateAgreementDto,
    auditContext: AuditContext,
  ): Promise<AgreementResponse> {
    const existing = await this.assertAgreementExists(id);

    if (existing.status !== AgreementStatus.DRAFT) {
      throw new BadRequestException(
        'Only draft agreements can be updated. Create a new version instead.',
      );
    }

    const agreement = await this.prisma.termsAndConditions.update({
      where: { id },
      data: {
        version: dto.version,
        title: dto.title,
        content: dto.content,
        type: dto.type,
        effectiveDate: dto.effectiveDate,
      },
      select: AGREEMENT_SELECT,
    });

    this.emitAudit(auditContext, {
      action: AGREEMENT_AUDIT_ACTIONS.UPDATED,
      targetId: String(id),
      payload: {
        version: dto.version,
        title: dto.title,
        type: dto.type,
        effectiveDate: dto.effectiveDate?.toISOString(),
      },
    });

    this.notifyStaff(
      NOTIFICATION_ACTIONS.AGREEMENTS.UPDATED,
      `${this.agreementTypeLabel(agreement.type)} draft updated`,
      `${this.agreementTypeLabel(agreement.type)} draft "${agreement.title}" (version ${agreement.version}) was updated.`,
      {
        agreementId: agreement.id,
        type: agreement.type,
        version: agreement.version,
        title: agreement.title,
      },
    );

    return agreement;
  }

  async updateStatus(
    id: number,
    dto: UpdateAgreementStatusDto,
    auditContext: AuditContext,
  ): Promise<AgreementResponse> {
    const existing = await this.assertAgreementExists(id);

    if (existing.status === dto.status) {
      throw new BadRequestException(`Agreement is already ${dto.status}`);
    }

    if (!isAllowedAgreementStatusTransition(existing.status, dto.status)) {
      throw new BadRequestException(
        `Cannot transition agreement from ${existing.status} to ${dto.status}`,
      );
    }

    const agreement =
      dto.status === AgreementStatus.PUBLISHED
        ? await this.publishAgreement(
            existing,
            await this.isAgreementUpdatePublish(existing),
            auditContext,
          )
        : await this.prisma.termsAndConditions.update({
            where: { id },
            data: { status: dto.status },
            select: AGREEMENT_SELECT,
          });

    this.emitAudit(auditContext, {
      action: AGREEMENT_AUDIT_ACTIONS.STATUS_CHANGED,
      targetId: String(id),
      payload: {
        from: existing.status,
        to: dto.status,
        type: existing.type,
        version: existing.version,
      },
    });

    if (dto.status === AgreementStatus.PUBLISHED) {
      this.notifyStaff(
        NOTIFICATION_ACTIONS.AGREEMENTS.PUBLISHED,
        `${this.agreementTypeLabel(agreement.type)} published`,
        `${this.agreementTypeLabel(agreement.type)} "${agreement.title}" (version ${agreement.version}) was published and is now in effect.`,
        {
          agreementId: agreement.id,
          type: agreement.type,
          version: agreement.version,
          title: agreement.title,
          from: existing.status,
        },
      );
    } else if (dto.status === AgreementStatus.ARCHIVED) {
      this.notifyStaff(
        NOTIFICATION_ACTIONS.AGREEMENTS.ARCHIVED,
        `${this.agreementTypeLabel(agreement.type)} archived`,
        `${this.agreementTypeLabel(agreement.type)} "${agreement.title}" (version ${agreement.version}) was archived.`,
        {
          agreementId: agreement.id,
          type: agreement.type,
          version: agreement.version,
          title: agreement.title,
          from: existing.status,
        },
      );
    }

    return agreement;
  }

  async remove(id: number, auditContext: AuditContext): Promise<void> {
    const existing = await this.assertAgreementExists(id);

    if (existing.status !== AgreementStatus.DRAFT) {
      throw new BadRequestException(
        'Only draft agreements can be deleted. Archive published versions instead.',
      );
    }

    await this.prisma.termsAndConditions.delete({
      where: { id },
    });

    this.emitAudit(auditContext, {
      action: AGREEMENT_AUDIT_ACTIONS.DELETED,
      targetId: String(id),
      payload: {
        version: existing.version,
        type: existing.type,
        title: existing.title,
      },
    });
  }

  private async publishAgreement(
    existing: AgreementRecord,
    isUpdate: boolean,
    auditContext: AuditContext,
  ): Promise<AgreementResponse> {
    if (!canPublishAgreement(existing.effectiveDate)) {
      throw new BadRequestException(
        'Cannot publish an agreement whose effectiveDate is in the future',
      );
    }

    const now = new Date();
    const copy = buildAgreementAnnouncement(existing.type, isUpdate);
    const window = agreementAnnouncementWindow(now);

    const [, published, announcement] = await this.prisma.$transaction([
      this.prisma.termsAndConditions.updateMany({
        where: {
          ...PLATFORM_AGREEMENT_SCOPE,
          type: existing.type,
          status: AgreementStatus.PUBLISHED,
          id: { not: existing.id },
        },
        data: { status: AgreementStatus.ARCHIVED },
      }),
      this.prisma.termsAndConditions.update({
        where: { id: existing.id },
        data: { status: AgreementStatus.PUBLISHED },
        select: AGREEMENT_SELECT,
      }),
      this.prisma.globalAnnouncement.create({
        data: {
          title: copy.title,
          content: copy.content,
          startsAt: window.startsAt,
          endsAt: window.endsAt,
        },
        select: { id: true, title: true },
      }),
    ]);

    this.auditEmitter.emit({
      ...auditContext,
      module: 'CONTENT_MANAGEMENT',
      action: ANNOUNCEMENT_AUDIT_ACTIONS.CREATED,
      targetId: String(announcement.id),
      targetType: 'GlobalAnnouncement',
      payload: {
        source: 'agreement-publish',
        agreementType: existing.type,
        agreementId: existing.id,
        isUpdate,
        title: announcement.title,
      },
    });

    return published;
  }

  private async isAgreementUpdatePublish(
    existing: AgreementRecord,
  ): Promise<boolean> {
    if (existing.status === AgreementStatus.ARCHIVED) {
      return true;
    }

    const priorLiveCount = await this.prisma.termsAndConditions.count({
      where: {
        ...PLATFORM_AGREEMENT_SCOPE,
        type: existing.type,
        id: { not: existing.id },
        status: {
          in: [AgreementStatus.PUBLISHED, AgreementStatus.ARCHIVED],
        },
      },
    });

    return priorLiveCount > 0;
  }

  private async loadPublicAgreements(): Promise<PublicAgreementsResponse> {
    const now = new Date();
    const active = await this.prisma.termsAndConditions.findMany({
      where: {
        ...PLATFORM_AGREEMENT_SCOPE,
        ...this.activePublishedWhere(now),
      },
      select: AGREEMENT_SELECT,
      orderBy: [{ effectiveDate: 'desc' }, { id: 'desc' }],
    });

    return {
      termsOfService:
        active.find((row) => row.type === AgreementType.TERMS_OF_SERVICE) ??
        null,
      privacyPolicy:
        active.find((row) => row.type === AgreementType.PRIVACY_POLICY) ?? null,
    };
  }

  private toUserStatusItem(
    agreement: AgreementResponse | null,
    acceptedAtByAgreementId: Map<number, Date>,
  ): UserAgreementStatusItem | null {
    if (!agreement) {
      return null;
    }

    const acceptedAt = acceptedAtByAgreementId.get(agreement.id) ?? null;

    return {
      id: agreement.id,
      version: agreement.version,
      title: agreement.title,
      type: agreement.type,
      accepted: acceptedAt !== null,
      acceptedAt,
    };
  }

  private normalizeAgreementIds(
    agreementIdOrIds: number | readonly number[],
  ): number[] {
    const unique = [
      ...new Set(
        Array.isArray(agreementIdOrIds) ? agreementIdOrIds : [agreementIdOrIds],
      ),
    ];

    if (unique.length === 0) {
      throw new BadRequestException('At least one agreement ID is required');
    }

    return unique;
  }

  private async acceptActiveAgreements(
    userId: number,
    agreementIds: readonly number[],
    ipAddress: string | undefined,
    auditContext: AuditContext,
  ): Promise<AcceptedAgreementItem[]> {
    const agreements = await this.prisma.termsAndConditions.findMany({
      where: {
        ...PLATFORM_AGREEMENT_SCOPE,
        id: { in: [...agreementIds] },
      },
      select: AGREEMENT_SELECT,
    });
    const agreementById = new Map(agreements.map((row) => [row.id, row]));

    for (const id of agreementIds) {
      const agreement = agreementById.get(id);
      if (!agreement) {
        throw new NotFoundException(`Agreement with ID ${id} not found`);
      }
      this.assertCurrentlyActive(agreement);
    }

    const existing = await this.prisma.userTncAcceptance.findMany({
      where: {
        userId,
        termsAndConditionsId: { in: [...agreementIds] },
      },
      select: {
        termsAndConditionsId: true,
        acceptedAt: true,
      },
    });
    const acceptedAtById = new Map(
      existing.map((row) => [row.termsAndConditionsId, row.acceptedAt]),
    );
    const pendingIds = agreementIds.filter((id) => !acceptedAtById.has(id));

    if (pendingIds.length > 0) {
      await this.prisma.userTncAcceptance.createMany({
        data: pendingIds.map((termsAndConditionsId) => ({
          userId,
          termsAndConditionsId,
          ipAddress,
        })),
        skipDuplicates: true,
      });

      const created = await this.prisma.userTncAcceptance.findMany({
        where: {
          userId,
          termsAndConditionsId: { in: [...pendingIds] },
        },
        select: {
          termsAndConditionsId: true,
          acceptedAt: true,
        },
      });

      for (const row of created) {
        acceptedAtById.set(row.termsAndConditionsId, row.acceptedAt);
        const agreement = agreementById.get(row.termsAndConditionsId);
        if (!agreement) {
          continue;
        }

        this.emitAudit(auditContext, {
          action: AGREEMENT_AUDIT_ACTIONS.ACCEPTED,
          targetId: String(row.termsAndConditionsId),
          payload: {
            userId,
            type: agreement.type,
            version: agreement.version,
          },
        });
      }
    }

    return agreementIds.map((id) => {
      const acceptedAt = acceptedAtById.get(id);
      if (!acceptedAt) {
        throw new BadRequestException(
          `Failed to record acceptance for agreement ${id}`,
        );
      }

      return { termsAndConditionsId: id, acceptedAt };
    });
  }

  private activePublishedWhere(now: Date): Prisma.TermsAndConditionsWhereInput {
    return {
      status: AgreementStatus.PUBLISHED,
      effectiveDate: { lte: now },
    };
  }

  private assertCurrentlyActive(agreement: AgreementRecord): void {
    if (
      agreement.status !== AgreementStatus.PUBLISHED ||
      !canPublishAgreement(agreement.effectiveDate)
    ) {
      throw new BadRequestException(
        'Only the currently published agreement can be accepted',
      );
    }
  }

  private async assertAgreementExists(id: number): Promise<AgreementRecord> {
    const agreement = await this.prisma.termsAndConditions.findFirst({
      where: {
        ...PLATFORM_AGREEMENT_SCOPE,
        id,
      },
      select: AGREEMENT_SELECT,
    });

    if (!agreement) {
      throw new NotFoundException(`Agreement with ID ${id} not found`);
    }

    return agreement;
  }

  private notifyStaff(
    actionKey: string,
    subject: string,
    message: string,
    templateData: Record<string, unknown>,
  ): void {
    const type = templateData.type;
    void this.notificationDispatcher.dispatch(actionKey, {
      subject,
      message,
      templateData: {
        ...templateData,
        ...(typeof type === 'string'
          ? { agreementType: this.agreementTypeLabel(type as AgreementType) }
          : {}),
        ...(templateData.version != null
          ? { version: String(templateData.version) }
          : {}),
      },
    });
  }

  private agreementTypeLabel(type: AgreementType): string {
    return type === AgreementType.TERMS_OF_SERVICE
      ? 'Terms of Service'
      : 'Privacy Policy';
  }

  private emitAudit(
    auditContext: AuditContext,
    params: {
      action: string;
      targetId?: string;
      payload?: Record<string, unknown>;
    },
  ): void {
    this.auditEmitter.emit({
      ...auditContext,
      module: 'SYSTEM_CONFIGURATIONS',
      targetType: 'TermsAndConditions',
      ...params,
    });
  }
}
