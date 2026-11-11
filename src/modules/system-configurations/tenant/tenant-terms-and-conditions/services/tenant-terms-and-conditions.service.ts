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
import { resolveTenantBrandName } from '../../../../tenants/shared/utils/resolve-tenant-brand-name.util';
import { TenantLoanApplicationEligibilityService } from '../../../../tenants/shared/services/tenant-loan-application-eligibility.service';
import { NOTIFICATION_ACTIONS } from '../../../../../core/notifications/constants/notification-action-keys.constant';
import { NotificationDispatcherService } from '../../../../../core/notifications/services/notification-dispatcher.service';
import {
  canPublishAgreement,
  isAllowedAgreementStatusTransition,
} from '../../../platform/terms-and-conditions/constants/agreement-status.constant';
import { CreateAgreementDto } from '../../../platform/terms-and-conditions/dto/create-agreement.dto';
import { ListAgreementsQueryDto } from '../../../platform/terms-and-conditions/dto/list-agreements-query.dto';
import { UpdateAgreementDto } from '../../../platform/terms-and-conditions/dto/update-agreement.dto';
import { UpdateAgreementStatusDto } from '../../../platform/terms-and-conditions/dto/update-agreement-status.dto';
import type {
  AcceptAgreementResponse,
  AcceptAgreementsResponse,
  AcceptedAgreementItem,
  UserAgreementStatusItem,
  UserAgreementStatusResponse,
} from '../../../platform/terms-and-conditions/services/terms-and-conditions.service';
import { TENANT_AGREEMENT_AUDIT_ACTIONS } from '../constants/tenant-agreement-audit-actions.constant';

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

type AgreementRecord = Prisma.TermsAndConditionsGetPayload<{
  select: typeof AGREEMENT_SELECT;
}>;

export interface TenantAgreementResponse {
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

export interface TenantPublicAgreementsResponse {
  termsOfService: TenantAgreementResponse | null;
  privacyPolicy: TenantAgreementResponse | null;
}

@Injectable()
export class TenantTermsAndConditionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditEmitter: AuditEmitterService,
    private readonly notificationDispatcher: NotificationDispatcherService,
    private readonly eligibility: TenantLoanApplicationEligibilityService,
  ) {}

  async create(
    tenantId: string,
    dto: CreateAgreementDto,
    auditContext: AuditContext,
  ): Promise<TenantAgreementResponse> {
    const agreement = await this.prisma.termsAndConditions.create({
      data: {
        tenantId,
        version: dto.version,
        title: dto.title,
        content: dto.content,
        type: dto.type,
        effectiveDate: dto.effectiveDate,
        status: AgreementStatus.DRAFT,
      },
      select: AGREEMENT_SELECT,
    });

    this.emitAudit(tenantId, auditContext, {
      action: TENANT_AGREEMENT_AUDIT_ACTIONS.CREATED,
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
      `A new ${this.agreementTypeLabel(agreement.type)} draft "${agreement.title}" (version ${agreement.version}) was created for your tenant.`,
      {
        agreementId: agreement.id,
        type: agreement.type,
        version: agreement.version,
        title: agreement.title,
        tenantId,
      },
    );

    return agreement;
  }

  async findAll(
    tenantId: string,
    query: ListAgreementsQueryDto,
  ): Promise<TenantAgreementResponse[]> {
    const where: Prisma.TermsAndConditionsWhereInput = { tenantId };

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

  async findOne(
    tenantId: string,
    id: number,
  ): Promise<TenantAgreementResponse> {
    return this.assertAgreementExists(tenantId, id);
  }

  findCurrent(tenantId: string): Promise<TenantPublicAgreementsResponse> {
    return this.loadPublicAgreements(tenantId);
  }

  findPublic(tenantId: string): Promise<TenantPublicAgreementsResponse> {
    return this.loadPublicAgreements(tenantId);
  }

  /**
   * Customer status against this tenant's currently published agreements.
   * Response shape matches platform UserAgreementStatusResponse for shared UI.
   */
  async getStatusForUser(
    tenantId: string,
    userId: number,
  ): Promise<UserAgreementStatusResponse> {
    const published = await this.loadPublicAgreements(tenantId);
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
   * Hard gate for customer writes against a specific institution (e.g. loan apply).
   */
  async assertCurrentAgreementsAccepted(
    tenantId: string,
    userId: number,
  ): Promise<void> {
    const status = await this.getStatusForUser(tenantId, userId);

    if (status.requiresAcceptance) {
      throw appHttpException(
        HttpStatus.FORBIDDEN,
        "You must accept this institution's Terms of Service and Privacy Policy before continuing",
        APP_ERROR_CODES.CUSTOMER_TENANT_AGREEMENTS_NOT_ACCEPTED,
      );
    }
  }

  async accept(
    tenantId: string,
    userId: number,
    agreementId: number,
    ipAddress: string | undefined,
    auditContext: AuditContext,
  ): Promise<AcceptAgreementResponse>;
  async accept(
    tenantId: string,
    userId: number,
    agreementIds: readonly number[],
    ipAddress: string | undefined,
    auditContext: AuditContext,
  ): Promise<AcceptAgreementsResponse>;
  async accept(
    tenantId: string,
    userId: number,
    agreementIdOrIds: number | readonly number[],
    ipAddress: string | undefined,
    auditContext: AuditContext,
  ): Promise<AcceptAgreementResponse | AcceptAgreementsResponse> {
    const isBatch = Array.isArray(agreementIdOrIds);
    const accepted = await this.acceptActiveAgreements(
      tenantId,
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
    tenantId: string,
    id: number,
    dto: UpdateAgreementDto,
    auditContext: AuditContext,
  ): Promise<TenantAgreementResponse> {
    const existing = await this.assertAgreementExists(tenantId, id);

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

    this.emitAudit(tenantId, auditContext, {
      action: TENANT_AGREEMENT_AUDIT_ACTIONS.UPDATED,
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
      `${this.agreementTypeLabel(agreement.type)} draft "${agreement.title}" (version ${agreement.version}) was updated for your tenant.`,
      {
        agreementId: agreement.id,
        type: agreement.type,
        version: agreement.version,
        title: agreement.title,
        tenantId,
      },
    );

    return agreement;
  }

  async updateStatus(
    tenantId: string,
    id: number,
    dto: UpdateAgreementStatusDto,
    auditContext: AuditContext,
  ): Promise<TenantAgreementResponse> {
    const existing = await this.assertAgreementExists(tenantId, id);

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
        ? await this.publishAgreement(tenantId, existing)
        : await this.prisma.termsAndConditions.update({
            where: { id },
            data: { status: dto.status },
            select: AGREEMENT_SELECT,
          });

    this.emitAudit(tenantId, auditContext, {
      action: TENANT_AGREEMENT_AUDIT_ACTIONS.STATUS_CHANGED,
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
        `${this.agreementTypeLabel(agreement.type)} "${agreement.title}" (version ${agreement.version}) was published for your tenant.`,
        {
          agreementId: agreement.id,
          type: agreement.type,
          version: agreement.version,
          title: agreement.title,
          from: existing.status,
          tenantId,
        },
      );
    } else if (dto.status === AgreementStatus.ARCHIVED) {
      this.notifyStaff(
        NOTIFICATION_ACTIONS.AGREEMENTS.ARCHIVED,
        `${this.agreementTypeLabel(agreement.type)} archived`,
        `${this.agreementTypeLabel(agreement.type)} "${agreement.title}" (version ${agreement.version}) was archived for your tenant.`,
        {
          agreementId: agreement.id,
          type: agreement.type,
          version: agreement.version,
          title: agreement.title,
          from: existing.status,
          tenantId,
        },
      );
    }

    if (
      dto.status === AgreementStatus.PUBLISHED ||
      dto.status === AgreementStatus.ARCHIVED
    ) {
      await this.eligibility.refresh(tenantId);
    }

    return agreement;
  }

  async remove(
    tenantId: string,
    id: number,
    auditContext: AuditContext,
  ): Promise<void> {
    const existing = await this.assertAgreementExists(tenantId, id);

    if (existing.status !== AgreementStatus.DRAFT) {
      throw new BadRequestException(
        'Only draft agreements can be deleted. Archive published versions instead.',
      );
    }

    await this.prisma.termsAndConditions.delete({
      where: { id },
    });

    this.emitAudit(tenantId, auditContext, {
      action: TENANT_AGREEMENT_AUDIT_ACTIONS.DELETED,
      targetId: String(id),
      payload: {
        version: existing.version,
        type: existing.type,
        title: existing.title,
      },
    });
  }

  private async publishAgreement(
    tenantId: string,
    existing: AgreementRecord,
  ): Promise<TenantAgreementResponse> {
    if (!canPublishAgreement(existing.effectiveDate)) {
      throw new BadRequestException(
        'Cannot publish an agreement whose effectiveDate is in the future',
      );
    }

    const [, published] = await this.prisma.$transaction([
      this.prisma.termsAndConditions.updateMany({
        where: {
          tenantId,
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
    ]);

    return published;
  }

  private async loadPublicAgreements(
    tenantId: string,
  ): Promise<TenantPublicAgreementsResponse> {
    const now = new Date();
    const active = await this.prisma.termsAndConditions.findMany({
      where: {
        tenantId,
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
    agreement: TenantAgreementResponse | null,
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
    tenantId: string,
    userId: number,
    agreementIds: readonly number[],
    ipAddress: string | undefined,
    auditContext: AuditContext,
  ): Promise<AcceptedAgreementItem[]> {
    const agreements = await this.prisma.termsAndConditions.findMany({
      where: {
        id: { in: [...agreementIds] },
        tenantId,
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

        this.emitAudit(tenantId, auditContext, {
          action: TENANT_AGREEMENT_AUDIT_ACTIONS.ACCEPTED,
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

  private activePublishedWhere(now: Date): Prisma.TermsAndConditionsWhereInput {
    return {
      status: AgreementStatus.PUBLISHED,
      effectiveDate: { lte: now },
    };
  }

  private async assertAgreementExists(
    tenantId: string,
    id: number,
  ): Promise<AgreementRecord> {
    const agreement = await this.prisma.termsAndConditions.findFirst({
      where: { id, tenantId },
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
    const tenantId =
      typeof templateData.tenantId === 'string' ? templateData.tenantId : null;
    void this.dispatchAgreementNotice(
      actionKey,
      subject,
      message,
      templateData,
      tenantId,
    );
  }

  private async dispatchAgreementNotice(
    actionKey: string,
    subject: string,
    message: string,
    templateData: Record<string, unknown>,
    tenantId: string | null,
  ): Promise<void> {
    let organization = '';
    if (tenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { tenantId },
        select: {
          name: true,
          brandProfile: { select: { brandName: true } },
        },
      });
      organization = resolveTenantBrandName({
        tenantName: tenant?.name,
        brandName: tenant?.brandProfile?.brandName,
      });
    }

    const type = templateData.type;
    void this.notificationDispatcher.dispatch(actionKey, {
      subject,
      message,
      templateData: {
        ...templateData,
        ...(organization ? { organization } : {}),
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
      module: 'TENANT',
      targetType: 'TermsAndConditions',
      ...params,
    });
  }
}
