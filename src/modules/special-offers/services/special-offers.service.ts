import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DiscountType,
  Prisma,
  SpecialOfferStatus,
  type SpecialOfferConfig,
} from '@prisma/client';
import type { AuditContext } from '../../../core/audit/interfaces/audit-payload.interface';
import { AuditEmitterService } from '../../../core/audit/services/audit-emitter.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { BrevoEmailService } from '../../../core/email/services/brevo-email.service';
import { NOTIFICATION_TYPES } from '../../../core/notifications/constants/notification-type.constant';
import { NotificationsService } from '../../../core/notifications/services/notifications.service';
import { TenantBrandNameService } from '../../tenants/shared/services/tenant-brand-name.service';
import { formatDisplayDateTime } from '../../../common/utils/format-date.util';
import { resolveTenantLogoUrl } from '../../tenants/shared/utils/resolve-tenant-logo-url.util';
import type {
  OfferIssuer,
  OfferUserActor,
} from '../constants/special-offer.constants';
import { CreateManualOfferDto } from '../dto/create-manual-offer.dto';
import { ListSpecialOffersQueryDto } from '../dto/list-special-offers-query.dto';
import { UpdateOfferConfigDto } from '../dto/update-offer-config.dto';
import { buildSpecialOfferAwardedEmail } from '../templates/special-offer-awarded.email';

export interface SpecialOfferConfigResponse {
  id: number;
  tenantId: string;
  isEnabled: boolean;
  loanInterval: number;
  discountType: DiscountType;
  discountValue: number;
  validForDays: number;
  allowDefaultedUsers: boolean;
  updatedAt: Date;
}

export interface SpecialOfferResponse {
  id: number;
  tenantId: string;
  customerId: string;
  /** Null when issued by the automated reward engine. Prefer `issuedBy` for display. */
  issuedById: string | null;
  issuedBy: OfferIssuer;
  discountType: DiscountType;
  /** Literal value: 3 = 3% when PERCENTAGE, or currency units when FIXED_AMOUNT. */
  discountValue: number;
  status: SpecialOfferStatus;
  isModalDismissed: boolean;
  dismissedAt: Date | null;
  issuedAt: Date;
  expiresAt: Date;
  redeemedAt: Date | null;
  redeemedLoanId: string | null;
  issuedReason: string | null;
  cancelledAt: Date | null;
  /** Always a real staff user when status is CANCELLED; never system. */
  cancelledById: string | null;
  cancelledBy: OfferUserActor | null;
  cancellationReason: string | null;
  issuingBrand: {
    tenantId: string;
    name: string;
    logoUrl: string | null;
    brandColor: string | null;
    brandName: string | null;
    slogan: string | null;
    logoImgName: string | null;
  };
}

export interface SpecialOffersListResponse {
  data: SpecialOfferResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const ACTOR_USER_SELECT = {
  userId: true,
  fullname: true,
  email: true,
} as const;

const OFFER_SELECT = {
  id: true,
  tenantId: true,
  targetCustomer: true,
  issuedById: true,
  discountType: true,
  discountValue: true,
  status: true,
  isModalDismissed: true,
  dismissedAt: true,
  issuedAt: true,
  expiresAt: true,
  redeemedAt: true,
  redeemedLoanId: true,
  issuedReason: true,
  cancelledAt: true,
  cancelledById: true,
  cancellationReason: true,
  targetUser: { select: ACTOR_USER_SELECT },
  issuedBy: { select: ACTOR_USER_SELECT },
  cancelledBy: { select: ACTOR_USER_SELECT },
  tenant: {
    select: {
      tenantId: true,
      name: true,
      logoUrl: true,
      brandColor: true,
      brandProfile: {
        select: { brandName: true, slogan: true, logoImgName: true },
      },
    },
  },
} as const;

type OfferWithActors = Prisma.SpecialOfferGetPayload<{
  select: typeof OFFER_SELECT;
}>;

/** Prisma client or interactive-transaction client — lets loan-application flows share one tx. */
type DbClient = Prisma.TransactionClient | PrismaService;

/**
 * Trusted offer fields used by loan-application attach/approve math.
 * Callers must not trust client-supplied discount values.
 */
export interface ReservableOfferSnapshot {
  id: number;
  tenantId: string;
  targetCustomer: number;
  discountType: DiscountType;
  discountValue: number;
  status: SpecialOfferStatus;
  expiresAt: Date;
}

/**
 * Owns special-offer config + lifecycle.
 *
 * Status flow (loan applications):
 *   AVAILABLE → RESERVED (customer attaches offerId on apply/update)
 *            → REDEEMED  (staff approves; linked to loanId)
 *            → AVAILABLE (withdraw / decline / detach offer)
 *   AVAILABLE|RESERVED past expiresAt → EXPIRED (lazy on list/read)
 *
 * Global promotions block attach/reserve/redeem so customers cannot stack
 * promo rate + special-offer discount.
 */
@Injectable()
export class SpecialOffersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditEmitter: AuditEmitterService,
    private readonly emailService: BrevoEmailService,
    private readonly notificationsService: NotificationsService,
    private readonly tenantBrandNameService: TenantBrandNameService,
  ) {}

  async getConfig(
    tenantId: string,
  ): Promise<SpecialOfferConfigResponse | null> {
    const config = await this.prisma.specialOfferConfig.findUnique({
      where: { tenantId },
    });

    return config ? this.toConfigResponse(config) : null;
  }

  async updateConfig(
    tenantId: string,
    dto: UpdateOfferConfigDto,
    auditContext: AuditContext,
  ): Promise<SpecialOfferConfigResponse> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException(
        'At least one configuration field is required',
      );
    }

    this.assertDiscountValue(dto.discountType, dto.discountValue);

    const existingConfig = await this.prisma.specialOfferConfig.findUnique({
      where: { tenantId },
    });

    if (!existingConfig && dto.isEnabled === true) {
      throw new BadRequestException(
        'Configure automated special offer rule before you can enable it to take effect',
      );
    }

    const existing = existingConfig ?? (await this.getTenantConfig(tenantId));

    // Re-validate the merged type/value pair — a partial PATCH can leave an invalid combo
    // (e.g. switching to PERCENTAGE while an existing value is > 100).
    const nextType = dto.discountType ?? existing.discountType;
    const nextValue =
      dto.discountValue !== undefined
        ? dto.discountValue
        : Number(existing.discountValue);
    this.assertDiscountValue(nextType, nextValue);

    const updated = await this.prisma.specialOfferConfig.update({
      where: { tenantId },
      data: {
        ...(dto.isEnabled !== undefined ? { isEnabled: dto.isEnabled } : {}),
        ...(dto.loanInterval !== undefined
          ? { loanInterval: dto.loanInterval }
          : {}),
        ...(dto.discountType !== undefined
          ? { discountType: dto.discountType }
          : {}),
        ...(dto.discountValue !== undefined
          ? { discountValue: new Prisma.Decimal(dto.discountValue) }
          : {}),
        ...(dto.validForDays !== undefined
          ? { validForDays: dto.validForDays }
          : {}),
        ...(dto.allowDefaultedUsers !== undefined
          ? { allowDefaultedUsers: dto.allowDefaultedUsers }
          : {}),
      },
    });

    this.emitAudit(auditContext, {
      action: 'SPECIAL_OFFER_CONFIG_UPDATED',
      targetId: String(updated.id),
      payload: { ...dto },
    });

    return this.toConfigResponse(updated);
  }

  /**
   * Staff-issued offer (bypasses the automated reward engine).
   * `issuedById` is always a real user — never null/SYSTEM for this path.
   */
  async grantManualOffer(
    actorUserId: number,
    tenantId: string,
    dto: CreateManualOfferDto,
    auditContext: AuditContext,
  ): Promise<SpecialOfferResponse> {
    this.assertDiscountValue(dto.discountType, dto.discountValue);

    const customer = await this.prisma.user.findFirst({
      where: { userId: dto.customerId, deletedAt: null },
      select: { id: true, userId: true, email: true, fullname: true },
    });

    if (!customer) {
      throw new NotFoundException(`Customer ${dto.customerId} was not found`);
    }

    const config = await this.getTenantConfig(tenantId);
    // Per-grant override, else fall back to the tenant default window.
    const validForDays = dto.validForDays ?? config.validForDays;
    const now = new Date();
    const expiresAt = this.addDays(now, validForDays);

    const offer = await this.prisma.specialOffer.create({
      data: {
        tenantId,
        targetCustomer: customer.id,
        issuedById: actorUserId,
        discountType: dto.discountType,
        // Literal entered value: 3 → 3% when PERCENTAGE, or MWK units when FIXED_AMOUNT.
        discountValue: new Prisma.Decimal(dto.discountValue),
        status: SpecialOfferStatus.AVAILABLE,
        isModalDismissed: false,
        issuedAt: now,
        expiresAt,
        issuedReason: dto.reason ?? null,
      },
      select: OFFER_SELECT,
    });

    // Resets the loyalty interval clock used by the reward engine.
    await this.prisma.customerLoanActivity.upsert({
      where: {
        customerId_tenantId: {
          customerId: customer.id,
          tenantId,
        },
      },
      create: {
        customerId: customer.id,
        tenantId,
        lastOfferIssuedAt: now,
      },
      update: {
        lastOfferIssuedAt: now,
      },
    });

    this.emitAudit(auditContext, {
      action: 'MANUAL_OFFER_GRANTED',
      targetId: String(offer.id),
      payload: {
        customerId: customer.userId,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        reason: dto.reason,
        validForDays,
      },
    });

    const discountLabel = this.formatDiscountLabel(
      offer.discountType,
      offer.discountValue,
    );

    this.notificationsService.push({
      targetUser: customer.id,
      type: NOTIFICATION_TYPES.INFO,
      content: `You received a special offer: ${discountLabel}. Redeem before ${formatDisplayDateTime(offer.expiresAt)}.`,
    });

    if (customer.email) {
      const brandName =
        await this.tenantBrandNameService.resolveDisplayName(tenantId);
      const emailContent = buildSpecialOfferAwardedEmail({
        fullname: customer.fullname,
        brandName,
        discountLabel,
        expiresAt: offer.expiresAt,
        issuedBySystem: false,
      });

      void this.emailService.send({
        to: customer.email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });
    }

    return this.toOfferResponse(offer);
  }

  /**
   * Human-only cancellation. The reward engine never cancels offers.
   * Only AVAILABLE offers may be cancelled — RESERVED ones must be released
   * via the loan-application flow first (withdraw / decline / detach).
   */
  async cancelOffer(
    tenantId: string,
    offerId: number,
    actorUserId: number,
    reason: string,
    auditContext: AuditContext,
  ): Promise<SpecialOfferResponse> {
    if (!actorUserId) {
      throw new BadRequestException(
        'A human staff user is required to cancel an offer',
      );
    }

    const offer = await this.findOfferOrThrow(offerId, this.prisma, tenantId);

    if (offer.status !== SpecialOfferStatus.AVAILABLE) {
      throw new BadRequestException(
        `Only AVAILABLE offers can be cancelled (current status: ${offer.status})`,
      );
    }

    const canceller = await this.prisma.user.findFirst({
      where: { id: actorUserId, deletedAt: null },
      select: ACTOR_USER_SELECT,
    });

    if (!canceller) {
      throw new BadRequestException(
        'Cancelling user was not found or is inactive',
      );
    }

    const cancellationReason = reason.trim();
    if (!cancellationReason) {
      throw new BadRequestException('cancellationReason is required');
    }

    const updated = await this.prisma.specialOffer.update({
      where: { id_tenantId: { id: offerId, tenantId } },
      data: {
        status: SpecialOfferStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledById: actorUserId,
        cancellationReason,
      },
      select: OFFER_SELECT,
    });

    this.emitAudit(auditContext, {
      action: 'SPECIAL_OFFER_CANCELLED',
      targetId: String(offerId),
      payload: {
        cancellationReason,
        targetCustomer: offer.targetCustomer,
        cancelledById: canceller.userId,
      },
    });

    return this.toOfferResponse(updated);
  }

  /** Staff list — lazily expires past-due AVAILABLE/RESERVED rows before querying. */
  async findAll(
    tenantId: string,
    query: ListSpecialOffersQueryDto,
  ): Promise<SpecialOffersListResponse> {
    await this.expireStaleOffers(tenantId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    let targetCustomer: number | undefined;
    if (query.customerId) {
      const customer = await this.prisma.user.findFirst({
        where: { userId: query.customerId, deletedAt: null },
        select: { id: true },
      });
      if (!customer) {
        return {
          data: [],
          meta: { page, limit, total: 0, totalPages: 0 },
        };
      }
      targetCustomer = customer.id;
    }

    const where: Prisma.SpecialOfferWhereInput = {
      tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(targetCustomer !== undefined ? { targetCustomer } : {}),
    };

    const [total, offers] = await this.prisma.$transaction([
      this.prisma.specialOffer.count({ where }),
      this.prisma.specialOffer.findMany({
        where,
        select: OFFER_SELECT,
        orderBy: { issuedAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      data: offers.map((offer) => this.toOfferResponse(offer)),
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  /** Customer inbox — expires that customer's stale offers first. */
  async getMyOffers(userId: number): Promise<SpecialOfferResponse[]> {
    await this.expireStaleOffersForCustomer(userId);

    const offers = await this.prisma.specialOffer.findMany({
      where: { targetCustomer: userId },
      select: OFFER_SELECT,
      orderBy: { issuedAt: 'desc' },
    });

    return offers.map((offer) => this.toOfferResponse(offer));
  }

  /**
   * Marks the award modal as seen. Idempotent — does not change offer status
   * or redeemability; UI-only dismissal flag.
   */
  async dismissModal(
    offerId: number,
    userId: number,
  ): Promise<SpecialOfferResponse> {
    const offer = await this.findOfferForCustomerOrThrow(offerId, userId);

    if (offer.targetCustomer !== userId) {
      throw new ForbiddenException('You can only dismiss your own offers');
    }

    if (offer.isModalDismissed) {
      return this.toOfferResponse(offer);
    }

    const updated = await this.prisma.specialOffer.update({
      where: { id_tenantId: { id: offerId, tenantId: offer.tenantId } },
      data: {
        isModalDismissed: true,
        dismissedAt: new Date(),
      },
      select: OFFER_SELECT,
    });

    return this.toOfferResponse(updated);
  }

  /**
   * Read-only gate before attach. Does not mutate status except flipping
   * a past-due AVAILABLE offer to EXPIRED so it cannot be reserved next.
   * Rejects when a global promotion is active (no double discount).
   */
  async validateForApplicationAttachment(
    offerId: number,
    userId: number,
    db: DbClient = this.prisma,
  ): Promise<ReservableOfferSnapshot> {
    await this.assertNoActivePromotion(db);

    const offer = await this.findOfferForCustomerOrThrow(offerId, userId, db);

    if (offer.targetCustomer !== userId) {
      throw new ForbiddenException('You can only use your own offers');
    }

    // RESERVED elsewhere means another open application already holds this offer.
    if (offer.status !== SpecialOfferStatus.AVAILABLE) {
      throw new BadRequestException(
        `Offer is not available for attachment (status: ${offer.status})`,
      );
    }

    if (offer.expiresAt.getTime() <= Date.now()) {
      await db.specialOffer.update({
        where: { id_tenantId: { id: offerId, tenantId: offer.tenantId } },
        data: { status: SpecialOfferStatus.EXPIRED },
      });
      throw new BadRequestException('This special offer has expired');
    }

    return this.toReservableSnapshot(offer);
  }

  /**
   * AVAILABLE → RESERVED.
   * Called inside the loan-application create/update transaction so a failed
   * application write cannot leave a dangling reservation.
   */
  async reserveForApplication(
    offerId: number,
    userId: number,
    db: DbClient = this.prisma,
  ): Promise<ReservableOfferSnapshot> {
    const offer = await this.validateForApplicationAttachment(
      offerId,
      userId,
      db,
    );

    const updated = await db.specialOffer.update({
      where: { id_tenantId: { id: offer.id, tenantId: offer.tenantId } },
      data: { status: SpecialOfferStatus.RESERVED },
      select: OFFER_SELECT,
    });

    return this.toReservableSnapshot(updated);
  }

  /**
   * RESERVED → AVAILABLE.
   * Idempotent if the offer is no longer RESERVED (e.g. already expired/redeemed).
   * Used on withdraw, decline, staff delete, or when the customer detaches/switches offers.
   */
  async releaseReservation(
    offerId: number,
    userId: number,
    db: DbClient = this.prisma,
  ): Promise<void> {
    const offer = await this.findOfferForCustomerOrThrow(offerId, userId, db);

    if (offer.targetCustomer !== userId) {
      throw new ForbiddenException('You can only release your own offers');
    }

    if (offer.status !== SpecialOfferStatus.RESERVED) {
      return;
    }

    await db.specialOffer.update({
      where: { id_tenantId: { id: offerId, tenantId: offer.tenantId } },
      data: { status: SpecialOfferStatus.AVAILABLE },
    });
  }

  /**
   * Approve-path preflight: offer must still be RESERVED to this applicant,
   * not expired, and no promotion may have started since attach time.
   */
  async assertReservedOfferForApplicant(
    offerId: number,
    userId: number,
    db: DbClient = this.prisma,
  ): Promise<ReservableOfferSnapshot> {
    await this.assertNoActivePromotion(db);

    const offer = await this.findOfferForCustomerOrThrow(offerId, userId, db);

    if (offer.targetCustomer !== userId) {
      throw new ForbiddenException('Offer does not belong to this applicant');
    }

    if (offer.status !== SpecialOfferStatus.RESERVED) {
      throw new BadRequestException(
        `Offer must be RESERVED for approval (status: ${offer.status})`,
      );
    }

    if (offer.expiresAt.getTime() <= Date.now()) {
      await db.specialOffer.update({
        where: { id_tenantId: { id: offerId, tenantId: offer.tenantId } },
        data: { status: SpecialOfferStatus.EXPIRED },
      });
      throw new BadRequestException('This special offer has expired');
    }

    return this.toReservableSnapshot(offer);
  }

  /**
   * RESERVED → REDEEMED, binding `redeemedLoanId`.
   * Intended to run in the same transaction as loan create + application delete.
   * Unique on redeemedLoanId prevents two offers claiming one loan (P2002 → 400).
   */
  async redeemReservedOffer(
    offerId: number,
    loanId: string,
    userId: number,
    auditContext: AuditContext,
    db: DbClient = this.prisma,
  ): Promise<SpecialOfferResponse> {
    await this.assertReservedOfferForApplicant(offerId, userId, db);
    const reservedOffer = await this.findOfferForCustomerOrThrow(
      offerId,
      userId,
      db,
    );

    const existingRedemption = await db.specialOffer.findUnique({
      where: { redeemedLoanId: loanId },
      select: { id: true },
    });

    if (existingRedemption) {
      throw new BadRequestException(
        'A special offer has already been redeemed against this loan',
      );
    }

    try {
      const updated = await db.specialOffer.update({
        where: {
          id_tenantId: { id: offerId, tenantId: reservedOffer.tenantId },
        },
        data: {
          status: SpecialOfferStatus.REDEEMED,
          redeemedAt: new Date(),
          redeemedLoanId: loanId,
        },
        select: OFFER_SELECT,
      });

      this.emitAudit(auditContext, {
        action: 'SPECIAL_OFFER_REDEEMED',
        targetId: String(offerId),
        payload: {
          loanId,
          discountType: updated.discountType,
          discountValue: Number(updated.discountValue),
        },
      });

      return this.toOfferResponse(updated);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          'A special offer has already been redeemed against this loan',
        );
      }
      throw error;
    }
  }

  /**
   * Legacy direct redeem gate: AVAILABLE → REDEEMED (no RESERVED step).
   * Prefer `reserveForApplication` + `redeemReservedOffer` for the loan-application flow.
   * Kept for the standalone `POST :id/redeem` HTTP endpoint.
   */
  async validateRedemption(
    offerId: number,
    userId: number,
  ): Promise<OfferWithActors> {
    await this.assertNoActivePromotion();

    const offer = await this.findOfferForCustomerOrThrow(offerId, userId);

    if (offer.targetCustomer !== userId) {
      throw new ForbiddenException('You can only redeem your own offers');
    }

    if (offer.status !== SpecialOfferStatus.AVAILABLE) {
      throw new BadRequestException(
        `Offer is not available for redemption (status: ${offer.status})`,
      );
    }

    if (offer.expiresAt.getTime() <= Date.now()) {
      await this.prisma.specialOffer.update({
        where: { id_tenantId: { id: offerId, tenantId: offer.tenantId } },
        data: { status: SpecialOfferStatus.EXPIRED },
      });
      throw new BadRequestException('This special offer has expired');
    }

    return offer;
  }

  /**
   * Legacy redeem against an existing/pending loanId without going through RESERVED.
   * Loan row may not exist yet (checkout); when it does, ownership is enforced.
   */
  async redeemOffer(
    offerId: number,
    loanId: string,
    userId: number,
    auditContext: AuditContext,
  ): Promise<SpecialOfferResponse> {
    const offer = await this.findOfferForCustomerOrThrow(offerId, userId);
    await this.validateRedemption(offerId, userId);

    const loan = await this.prisma.loan.findUnique({
      where: { loanId },
      select: { loanId: true, customerId: true },
    });

    // Loan may be created in a later step; only enforce ownership when the row exists.
    if (loan && loan.customerId !== userId) {
      throw new ForbiddenException(
        'Loan does not belong to the authenticated customer',
      );
    }

    const existingRedemption = await this.prisma.specialOffer.findUnique({
      where: { redeemedLoanId: loanId },
      select: { id: true },
    });

    if (existingRedemption) {
      throw new BadRequestException(
        'A special offer has already been redeemed against this loan',
      );
    }

    try {
      const updated = await this.prisma.specialOffer.update({
        where: { id_tenantId: { id: offerId, tenantId: offer.tenantId } },
        data: {
          status: SpecialOfferStatus.REDEEMED,
          redeemedAt: new Date(),
          redeemedLoanId: loanId,
        },
        select: OFFER_SELECT,
      });

      this.emitAudit(auditContext, {
        action: 'SPECIAL_OFFER_REDEEMED',
        targetId: String(offerId),
        payload: {
          loanId,
          discountType: updated.discountType,
          discountValue: Number(updated.discountValue),
        },
      });

      return this.toOfferResponse(updated);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          'A special offer has already been redeemed against this loan',
        );
      }
      throw error;
    }
  }

  /** Blocks offer use whenever any promotion row is currently active. */
  private async assertNoActivePromotion(
    db: DbClient = this.prisma,
  ): Promise<void> {
    const activePromotion = await db.promotion.findFirst({
      where: { isActive: true },
      select: { promotionId: true },
    });

    if (activePromotion) {
      throw new BadRequestException(
        'Special offers cannot be used while a global promotion is active',
      );
    }
  }

  /** Decimal → number snapshot for approve-time return-amount math. */
  private toReservableSnapshot(
    offer: OfferWithActors,
  ): ReservableOfferSnapshot {
    return {
      id: offer.id,
      tenantId: offer.tenantId,
      targetCustomer: offer.targetCustomer,
      discountType: offer.discountType,
      discountValue: Number(offer.discountValue),
      status: offer.status,
      expiresAt: offer.expiresAt,
    };
  }

  /** Returns the tenant configuration, creating the disabled default on first access. */
  private async getTenantConfig(tenantId: string): Promise<SpecialOfferConfig> {
    return this.prisma.specialOfferConfig.upsert({
      where: { tenantId },
      update: {},
      create: {
        tenantId,
        isEnabled: false,
        loanInterval: 6,
        discountType: DiscountType.PERCENTAGE,
        discountValue: 0,
        validForDays: 30,
        allowDefaultedUsers: true,
      },
    });
  }

  private async findOfferOrThrow(
    offerId: number,
    db: DbClient = this.prisma,
    tenantId?: string,
  ): Promise<OfferWithActors> {
    const offer = await db.specialOffer.findUnique({
      where: tenantId
        ? { id_tenantId: { id: offerId, tenantId } }
        : { id: offerId },
      select: OFFER_SELECT,
    });

    if (!offer) {
      throw new NotFoundException(`Special offer ${offerId} was not found`);
    }

    return offer;
  }

  private async findOfferForCustomerOrThrow(
    offerId: number,
    customerId: number,
    db: DbClient = this.prisma,
  ): Promise<OfferWithActors> {
    const offer = await db.specialOffer.findFirst({
      where: { id: offerId, targetCustomer: customerId },
      select: OFFER_SELECT,
    });

    if (!offer) {
      throw new NotFoundException(`Special offer ${offerId} was not found`);
    }

    return offer;
  }

  /**
   * Lazy expiry for one customer. Includes RESERVED so a held-but-expired
   * offer cannot be approved after its window lapses.
   */
  private async expireStaleOffersForCustomer(userId: number): Promise<void> {
    await this.prisma.specialOffer.updateMany({
      where: {
        targetCustomer: userId,
        status: {
          in: [SpecialOfferStatus.AVAILABLE, SpecialOfferStatus.RESERVED],
        },
        expiresAt: { lte: new Date() },
      },
      data: { status: SpecialOfferStatus.EXPIRED },
    });
  }

  /** Lazy expiry across all customers (staff list). */
  private async expireStaleOffers(tenantId: string): Promise<void> {
    await this.prisma.specialOffer.updateMany({
      where: {
        tenantId,
        status: {
          in: [SpecialOfferStatus.AVAILABLE, SpecialOfferStatus.RESERVED],
        },
        expiresAt: { lte: new Date() },
      },
      data: { status: SpecialOfferStatus.EXPIRED },
    });
  }

  /**
   * `discountValue` meaning depends on `discountType`:
   * PERCENTAGE → points off interest (0–100); FIXED_AMOUNT → MWK off return.
   */
  private assertDiscountValue(
    discountType: DiscountType | undefined,
    discountValue: number | undefined,
  ): void {
    if (discountValue === undefined) {
      return;
    }

    if (discountValue < 0) {
      throw new BadRequestException('discountValue must be zero or greater');
    }

    if (discountType === DiscountType.PERCENTAGE && discountValue > 100) {
      throw new BadRequestException(
        'PERCENTAGE discountValue cannot exceed 100',
      );
    }
  }

  /** Human-readable label for notifications/emails. */
  private formatDiscountLabel(
    discountType: DiscountType,
    discountValue: Prisma.Decimal,
  ): string {
    const value = Number(discountValue);
    return discountType === DiscountType.PERCENTAGE
      ? `${value}% off`
      : `MWK ${value.toLocaleString()} off`;
  }

  private addDays(from: Date, days: number): Date {
    const result = new Date(from);
    result.setUTCDate(result.getUTCDate() + days);
    return result;
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
      module: 'SPECIAL_OFFERS',
      targetType: 'SpecialOffer',
      ...params,
    });
  }

  private toConfigResponse(
    config: SpecialOfferConfig,
  ): SpecialOfferConfigResponse {
    return {
      id: config.id,
      tenantId: config.tenantId,
      isEnabled: config.isEnabled,
      loanInterval: config.loanInterval,
      discountType: config.discountType,
      discountValue: Number(config.discountValue),
      validForDays: config.validForDays,
      allowDefaultedUsers: config.allowDefaultedUsers,
      updatedAt: config.updatedAt,
    };
  }

  /**
   * Null `issuedBy` means the automated reward engine issued the offer
   * (`issuedById` is null in the DB) — surface as SYSTEM, not a missing user.
   */
  private toIssuer(
    user: { userId: string; fullname: string; email: string | null } | null,
  ): OfferIssuer {
    if (!user) {
      return { type: 'SYSTEM' };
    }

    return this.toUserActor(user);
  }

  private toUserActor(user: {
    userId: string;
    fullname: string;
    email: string | null;
  }): OfferUserActor {
    return {
      type: 'USER',
      userId: user.userId,
      fullname: user.fullname,
      email: user.email,
    };
  }

  private toOfferResponse(offer: OfferWithActors): SpecialOfferResponse {
    const brandProfile = offer.tenant.brandProfile;

    return {
      id: offer.id,
      tenantId: offer.tenantId,
      customerId: offer.targetUser.userId,
      issuedById: offer.issuedBy?.userId ?? null,
      issuedBy: this.toIssuer(offer.issuedBy),
      discountType: offer.discountType,
      discountValue: Number(offer.discountValue),
      status: offer.status,
      isModalDismissed: offer.isModalDismissed,
      dismissedAt: offer.dismissedAt,
      issuedAt: offer.issuedAt,
      expiresAt: offer.expiresAt,
      redeemedAt: offer.redeemedAt,
      redeemedLoanId: offer.redeemedLoanId,
      issuedReason: offer.issuedReason,
      cancelledAt: offer.cancelledAt,
      cancelledById: offer.cancelledBy?.userId ?? null,
      // Cancel is human-only; never synthesize a SYSTEM canceller
      cancelledBy: offer.cancelledBy
        ? this.toUserActor(offer.cancelledBy)
        : null,
      cancellationReason: offer.cancellationReason,
      issuingBrand: {
        tenantId: offer.tenant.tenantId,
        name: offer.tenant.name,
        logoUrl: resolveTenantLogoUrl({
          logoUrl: offer.tenant.logoUrl,
          logoImgName: brandProfile?.logoImgName,
        }),
        brandColor: offer.tenant.brandColor,
        brandName: brandProfile?.brandName ?? null,
        slogan: brandProfile?.slogan ?? null,
        logoImgName: brandProfile?.logoImgName ?? null,
      },
    };
  }
}
