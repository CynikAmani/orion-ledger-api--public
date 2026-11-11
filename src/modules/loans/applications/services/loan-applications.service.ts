import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DiscountType, Prisma } from '@prisma/client';
import { APP_ERROR_CODES } from '../../../../common/exceptions/app-http.exception';
import { formatCurrency } from '../../../../common/utils/format-currency.util';
import type { AuditContext } from '../../../../core/audit/interfaces/audit-payload.interface';
import { AuditEmitterService } from '../../../../core/audit/services/audit-emitter.service';
import { PrismaService } from '../../../../core/database/prisma.service';
import { BrevoEmailService } from '../../../../core/email/services/brevo-email.service';
import { NOTIFICATION_ACTIONS } from '../../../../core/notifications/constants/notification-action-keys.constant';
import { loanNoticeFacts } from '../../../../core/notifications/templates/loan-notice-facts.util';
import { NOTIFICATION_TYPES } from '../../../../core/notifications/constants/notification-type.constant';
import { NotificationDispatcherService } from '../../../../core/notifications/services/notification-dispatcher.service';
import { NotificationsService } from '../../../../core/notifications/services/notifications.service';
import { UPLOAD_DIRS } from '../../../../core/storage/constants/upload-dirs.constant';
import { ImageStorageService } from '../../../../core/storage/services/image-storage.service';
import { CustomerLoanActivityService } from '../../../customers/loan-activity/services/customer-loan-activity.service';
import { LoanApplicationSettingsService } from '../../../loan-configurations/application-settings/services/loan-application-settings.service';
import { InterestRatesService } from '../../../loan-configurations/interest-rates/services/interest-rates.service';
import { SpecialOffersService } from '../../../special-offers/services/special-offers.service';
import { TenantBrandNameService } from '../../../tenants/shared/services/tenant-brand-name.service';
import { TenantLoanApplicationEligibilityService } from '../../../tenants/shared/services/tenant-loan-application-eligibility.service';
import { TenantService } from '../../../tenants/shared/services/tenant.service';
import { resolveTenantLogoUrl } from '../../../tenants/shared/utils/resolve-tenant-logo-url.util';
import { UserBusinessEligibilityValidator } from '../../../users/shared/validators/user-business-eligibility.validator';
import { LOAN_AUDIT_ACTIONS } from '../../records/constants/loan-audit-actions.constant';
import { LoansService } from '../../records/services/loans.service';
import type { LoanPeriodWindow } from '../../shared/types/loan-period-window';
import {
  assertLoanTypeBelongsToTenant,
  assertStaffTenantMatchesRecord,
} from '../../shared/utils/assert-staff-tenant-record.util';
import { LoanProvisionEligibilityValidator } from '../../shared/validators/loan-provision-eligibility.validator';
import { LOAN_APPLICATION_AUDIT_ACTIONS } from '../constants/loan-application-audit-actions.constant';
import { CreateLoanApplicationDto } from '../dto/create-loan-application.dto';
import { ListLoanApplicationsQueryDto } from '../dto/list-loan-applications-query.dto';
import { UpdateLoanApplicationDto } from '../dto/update-loan-application.dto';
import { buildLoanApplicationApprovedEmail } from '../templates/loan-application-approved.email';
import { buildLoanApplicationDeclinedEmail } from '../templates/loan-application-declined.email';
import { buildLoanApplicationReceivedEmail } from '../templates/loan-application-received.email';
import { buildApplicationRateSnapshot } from '../utils/build-application-rate-snapshot.util';
import type { OfferDiscountInput } from '../utils/calculate-loan-return.util';

const APPLICANT_SELECT = {
  userId: true,
  fullname: true,
  email: true,
} as const;

const OFFER_SELECT = {
  id: true,
  discountType: true,
  discountValue: true,
  status: true,
} as const;

const ISSUING_BRAND_SELECT = {
  tenantId: true,
  name: true,
  logoUrl: true,
  brandColor: true,
  brandProfile: {
    select: {
      brandName: true,
      slogan: true,
      logoImgName: true,
    },
  },
} as const;

const APPLICATION_SELECT = {
  id: true,
  tenantId: true,
  applicantId: true,
  loanAmount: true,
  collateral: true,
  collateralImageUrl: true,
  numWeeks: true,
  location: true,
  dateApplied: true,
  discount: true,
  specialOfferId: true,
  isReviewed: true,
  loanTypeId: true,
  activeRate: true,
  interestRate: true,
  expectedReturnAmount: true,
  users: { select: APPLICANT_SELECT },
  specialOffer: { select: OFFER_SELECT },
  tenant: { select: ISSUING_BRAND_SELECT },
} as const;

type ApplicationWithRelations = Prisma.LoanApplicationGetPayload<{
  select: typeof APPLICATION_SELECT;
}>;

export interface LoanApplicationOfferSummary {
  id: number;
  discountType: string;
  discountValue: number;
  status: string;
}

export interface LoanApplicationApplicantSummary {
  userId: string;
  fullname: string;
  email: string | null;
}

/** Matches SpecialOffersService issuingBrand shape for customer multi-tenant UX. */
export interface LoanApplicationIssuingBrand {
  tenantId: string;
  name: string;
  logoUrl: string | null;
  brandColor: string | null;
  brandName: string | null;
  slogan: string | null;
  logoImgName: string | null;
}

export interface LoanApplicationResponse {
  id: number;
  tenantId: string;
  applicantId: string;
  loanAmount: number;
  collateral: string | null;
  collateralImageUrl: string | null;
  numWeeks: number;
  location: string;
  dateApplied: Date | null;
  discount: number | null;
  specialOfferId: number | null;
  specialOffer: LoanApplicationOfferSummary | null;
  applicant: LoanApplicationApplicantSummary;
  issuingBrand: LoanApplicationIssuingBrand;
  /** Present for staff; for customers only when loan-config visibility is enabled. */
  isReviewed?: boolean;
}

/**
 * Detail payload — list fields plus rate/return snapshots frozen at apply/update.
 * No live InterestRate lookup (catalog may change or be deleted).
 */
export interface LoanApplicationDetailResponse extends LoanApplicationResponse {
  /** Catalog activeRate snapshot; null only for legacy rows missing snapshots. */
  activeRate: number | null;
  /** Effective rate snapshot after offer. */
  interestRate: number | null;
  /** Expected return snapshot. */
  expectedReturnAmount: number | null;
}

export interface LoanApplicationsListResponse {
  data: LoanApplicationResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApproveLoanApplicationResponse {
  loanId: string;
  customer: LoanApplicationApplicantSummary;
}

export interface PendingPipelineMetrics {
  pendingUnreviewedApplicationCount: number;
  pendingReviewVolume: number;
}

export interface PeriodApplicationMetrics {
  submittedCount: number;
  approvedCount: number;
  rejectedCount: number;
  approvalRatePercentage: number;
}

@Injectable()
export class LoanApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditEmitter: AuditEmitterService,
    private readonly imageStorage: ImageStorageService,
    private readonly emailService: BrevoEmailService,
    private readonly notificationsService: NotificationsService,
    private readonly notificationDispatcher: NotificationDispatcherService,
    private readonly userBusinessEligibilityValidator: UserBusinessEligibilityValidator,
    private readonly specialOffersService: SpecialOffersService,
    private readonly interestRatesService: InterestRatesService,
    private readonly loansService: LoansService,
    private readonly customerLoanActivityService: CustomerLoanActivityService,
    private readonly loanApplicationSettingsService: LoanApplicationSettingsService,
    private readonly loanProvisionEligibilityValidator: LoanProvisionEligibilityValidator,
    private readonly tenantService: TenantService,
    private readonly tenantBrandNameService: TenantBrandNameService,
    private readonly eligibility: TenantLoanApplicationEligibilityService,
  ) {}

  async createMine(
    applicantId: number,
    dto: CreateLoanApplicationDto,
    auditContext: AuditContext,
    file?: Express.Multer.File,
  ): Promise<LoanApplicationResponse> {
    const applicantHandle = await this.resolveUserHandle(applicantId);
    await this.userBusinessEligibilityValidator.assertUserAccountIsNotBlocked(
      applicantHandle,
    );
    await this.loanProvisionEligibilityValidator.assertUserAgreementsAccepted(
      applicantId,
      {
        errorCode: APP_ERROR_CODES.CUSTOMER_AGREEMENTS_NOT_ACCEPTED,
        message:
          'You must accept the current Terms of Service and Privacy Policy before continuing',
      },
    );

    const tenant = await this.tenantService.resolveTenantByIdentifier(
      dto.tenantIdentifier,
      { allowDemoWhenEnabled: true },
    );
    const tenantId = tenant.tenantId;

    await this.eligibility.assertReadyForLoanApplications(tenantId);

    await this.loanProvisionEligibilityValidator.assertUserTenantAgreementsAccepted(
      applicantId,
      tenantId,
    );

    await this.loanApplicationSettingsService.assertLoanAmountWithinLimits(
      tenantId,
      dto.loanAmount,
    );

    const collateralImageUrl = file
      ? await this.imageStorage.save(
          file,
          UPLOAD_DIRS.LOAN_APPLICATION_COLLATERAL,
        )
      : null;

    try {
      const application = await this.prisma.$transaction(async (tx) => {
        let specialOfferId: number | null = null;
        let discount = 0;
        let offerDiscount: OfferDiscountInput | null = null;

        if (dto.offerId !== undefined) {
          const reserved = await this.reserveOfferForTenant(
            dto.offerId,
            applicantId,
            tenantId,
            tx,
          );
          specialOfferId = reserved.id;
          discount = Math.round(reserved.discountValue);
          offerDiscount = {
            discountType: reserved.discountType,
            discountValue: reserved.discountValue,
          };
        }

        const rateSnapshot = await this.resolveRateSnapshot(
          tenantId,
          dto.loanAmount,
          dto.numWeeks,
          offerDiscount,
        );

        const created = await tx.loanApplication.create({
          data: {
            tenantId,
            applicantId,
            loanAmount: dto.loanAmount,
            collateral: dto.collateral,
            collateralImageUrl,
            numWeeks: dto.numWeeks,
            location: dto.location,
            discount,
            specialOfferId,
            dateApplied: new Date(),
            loanTypeId: rateSnapshot.loanTypeId,
            activeRate: rateSnapshot.activeRate,
            interestRate: rateSnapshot.interestRate,
            expectedReturnAmount: rateSnapshot.expectedReturnAmount,
          },
          select: APPLICATION_SELECT,
        });

        await this.customerLoanActivityService.recordApplicationSubmitted(
          applicantId,
          tenantId,
          tx,
        );

        return created;
      });

      this.emitAudit(auditContext, {
        action: LOAN_APPLICATION_AUDIT_ACTIONS.CREATED,
        targetId: String(application.id),
        payload: {
          tenantId,
          loanAmount: application.loanAmount,
          numWeeks: application.numWeeks,
          specialOfferId: application.specialOfferId,
          collateralImageUrl,
        },
      });

      const brandName =
        await this.tenantBrandNameService.resolveDisplayName(tenantId);
      const loanTypeName = await this.resolveLoanTypeName(
        application.loanTypeId,
      );

      if (application.users.email) {
        const emailContent = buildLoanApplicationReceivedEmail({
          fullname: application.users.fullname,
          brandName,
          loanAmount: application.loanAmount,
          numWeeks: application.numWeeks,
          expectedReturnAmount: application.expectedReturnAmount,
          interestRate: application.interestRate,
          loanTypeName,
        });
        void this.emailService.send({
          to: application.users.email,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
        });
      }

      void this.notificationDispatcher.dispatch(
        NOTIFICATION_ACTIONS.LOAN_APPLICATIONS.SUBMITTED,
        {
          subject: 'New loan application',
          message: `${application.users.fullname} submitted a loan application for ${formatCurrency(application.loanAmount)}.`,
          templateData: {
            ...loanNoticeFacts({
              organization: brandName,
              customerName: application.users.fullname,
              loanTypeName,
              loanAmount: application.loanAmount,
              returnAmount: application.expectedReturnAmount,
              interestRate: application.interestRate,
              numWeeks: application.numWeeks,
              location: application.location,
              collateral: application.collateral,
              submittedAt: application.dateApplied ?? new Date(),
            }),
            applicationId: application.id,
          },
        },
        { tenantId },
      );

      const statusVisible =
        await this.loanApplicationSettingsService.isApplicationStatusVisibleToApplicant(
          tenantId,
        );

      return this.toResponse(application, { includeReviewed: statusVisible });
    } catch (error) {
      await this.imageStorage.deleteIfExists(collateralImageUrl);
      throw error;
    }
  }

  async findMine(applicantId: number): Promise<LoanApplicationResponse[]> {
    const rows = await this.prisma.loanApplication.findMany({
      where: { applicantId },
      select: APPLICATION_SELECT,
      orderBy: { dateApplied: 'desc' },
    });

    const visibilityByTenant = await this.resolveStatusVisibilityByTenant(
      rows.map((row) => row.tenantId),
    );

    return rows.map((row) =>
      this.toResponse(row, {
        includeReviewed: visibilityByTenant.get(row.tenantId) ?? false,
      }),
    );
  }

  async findOneMine(
    applicantId: number,
    id: number,
  ): Promise<LoanApplicationDetailResponse> {
    const application = await this.assertOwnedApplication(id, applicantId);
    const statusVisible =
      await this.loanApplicationSettingsService.isApplicationStatusVisibleToApplicant(
        application.tenantId,
      );

    return this.toDetailResponse(application, {
      includeReviewed: statusVisible,
    });
  }

  async updateMine(
    applicantId: number,
    id: number,
    dto: UpdateLoanApplicationDto,
    auditContext: AuditContext,
    file?: Express.Multer.File,
  ): Promise<LoanApplicationResponse> {
    const applicantHandle = await this.resolveUserHandle(applicantId);
    await this.userBusinessEligibilityValidator.assertUserAccountIsNotBlocked(
      applicantHandle,
    );

    const existing = await this.assertOwnedApplication(id, applicantId);
    const tenantId = existing.tenantId;

    if (dto.loanAmount !== undefined) {
      await this.loanApplicationSettingsService.assertLoanAmountWithinLimits(
        tenantId,
        dto.loanAmount,
      );
    }

    const nextImageUrl = file
      ? await this.imageStorage.save(
          file,
          UPLOAD_DIRS.LOAN_APPLICATION_COLLATERAL,
        )
      : undefined;

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        let specialOfferId = existing.specialOfferId;
        let discount = existing.discount ?? 0;
        let offerDiscount: OfferDiscountInput | null = existing.specialOffer
          ? {
              discountType: existing.specialOffer.discountType,
              discountValue: Number(existing.specialOffer.discountValue),
            }
          : null;

        if (dto.offerId !== undefined) {
          if (
            existing.specialOfferId &&
            existing.specialOfferId !== dto.offerId
          ) {
            await this.specialOffersService.releaseReservation(
              existing.specialOfferId,
              applicantId,
              tx,
            );
          }

          if (dto.offerId === null) {
            if (existing.specialOfferId) {
              await this.specialOffersService.releaseReservation(
                existing.specialOfferId,
                applicantId,
                tx,
              );
            }
            specialOfferId = null;
            discount = 0;
            offerDiscount = null;
          } else if (dto.offerId !== existing.specialOfferId) {
            const reserved = await this.reserveOfferForTenant(
              dto.offerId,
              applicantId,
              tenantId,
              tx,
            );
            specialOfferId = reserved.id;
            discount = Math.round(reserved.discountValue);
            offerDiscount = {
              discountType: reserved.discountType,
              discountValue: reserved.discountValue,
            };
          }
        }

        const nextAmount = dto.loanAmount ?? existing.loanAmount;
        const nextWeeks = dto.numWeeks ?? existing.numWeeks;
        const quoteInputsChanged =
          dto.loanAmount !== undefined ||
          dto.numWeeks !== undefined ||
          dto.offerId !== undefined;

        const rateSnapshot = quoteInputsChanged
          ? await this.resolveRateSnapshot(
              tenantId,
              nextAmount,
              nextWeeks,
              offerDiscount,
            )
          : null;

        return tx.loanApplication.update({
          where: { id },
          data: {
            ...(dto.loanAmount !== undefined
              ? { loanAmount: dto.loanAmount }
              : {}),
            ...(dto.collateral !== undefined
              ? { collateral: dto.collateral }
              : {}),
            ...(dto.numWeeks !== undefined ? { numWeeks: dto.numWeeks } : {}),
            ...(dto.location !== undefined ? { location: dto.location } : {}),
            ...(nextImageUrl !== undefined
              ? { collateralImageUrl: nextImageUrl }
              : {}),
            ...(dto.offerId !== undefined ? { specialOfferId, discount } : {}),
            ...(rateSnapshot
              ? {
                  loanTypeId: rateSnapshot.loanTypeId,
                  activeRate: rateSnapshot.activeRate,
                  interestRate: rateSnapshot.interestRate,
                  expectedReturnAmount: rateSnapshot.expectedReturnAmount,
                }
              : {}),
            isReviewed: false,
            dateApplied: new Date(),
          },
          select: APPLICATION_SELECT,
        });
      });

      if (nextImageUrl) {
        await this.imageStorage.deleteIfExists(existing.collateralImageUrl);
      }

      this.emitAudit(auditContext, {
        action: LOAN_APPLICATION_AUDIT_ACTIONS.UPDATED,
        targetId: String(id),
        payload: { ...dto, collateralImageUrl: updated.collateralImageUrl },
      });

      const statusVisible =
        await this.loanApplicationSettingsService.isApplicationStatusVisibleToApplicant(
          tenantId,
        );

      return this.toResponse(updated, { includeReviewed: statusVisible });
    } catch (error) {
      await this.imageStorage.deleteIfExists(nextImageUrl ?? null);
      throw error;
    }
  }

  async deleteMine(
    applicantId: number,
    id: number,
    auditContext: AuditContext,
  ): Promise<void> {
    const existing = await this.assertOwnedApplication(id, applicantId);

    await this.prisma.$transaction(async (tx) => {
      if (existing.specialOfferId) {
        await this.specialOffersService.releaseReservation(
          existing.specialOfferId,
          applicantId,
          tx,
        );
      }

      await tx.loanApplication.delete({ where: { id } });
    });

    await this.imageStorage.deleteIfExists(existing.collateralImageUrl);

    this.emitAudit(auditContext, {
      action: LOAN_APPLICATION_AUDIT_ACTIONS.DELETED,
      targetId: String(id),
      payload: { applicantId, mode: 'self' },
    });
  }

  async findAll(
    tenantId: string,
    query: ListLoanApplicationsQueryDto,
  ): Promise<LoanApplicationsListResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.LoanApplicationWhereInput = {
      tenantId,
      ...(query.applicantId ? { users: { userId: query.applicantId } } : {}),
      ...(query.isReviewed !== undefined
        ? { isReviewed: query.isReviewed }
        : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.loanApplication.count({ where }),
      this.prisma.loanApplication.findMany({
        where,
        select: APPLICATION_SELECT,
        orderBy: { dateApplied: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      data: rows.map((row) => this.toResponse(row, { includeReviewed: true })),
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async countUnreviewed(tenantId: string): Promise<number> {
    const pipeline = await this.getPendingPipelineMetrics(tenantId);
    return pipeline.pendingUnreviewedApplicationCount;
  }

  async getPendingPipelineMetrics(
    tenantId: string,
  ): Promise<PendingPipelineMetrics> {
    const [pendingUnreviewedApplicationCount, volume] = await Promise.all([
      this.prisma.loanApplication.count({
        where: { tenantId, isReviewed: false },
      }),
      this.prisma.loanApplication.aggregate({
        where: { tenantId, isReviewed: false },
        _sum: { loanAmount: true },
      }),
    ]);

    return {
      pendingUnreviewedApplicationCount,
      pendingReviewVolume: volume._sum.loanAmount ?? 0,
    };
  }

  /**
   * Funnel from audit actions. Approved/declined applications are deleted,
   * so live application rows cannot reconstruct the period.
   */
  async getPeriodApplicationMetrics(
    tenantId: string,
    window: LoanPeriodWindow,
  ): Promise<PeriodApplicationMetrics> {
    const createdAt = { gte: window.start, lt: window.endExclusive };
    const groups = await this.prisma.auditLog.groupBy({
      by: ['action'],
      where: {
        tenantId,
        createdAt,
        action: {
          in: [
            LOAN_APPLICATION_AUDIT_ACTIONS.CREATED,
            LOAN_APPLICATION_AUDIT_ACTIONS.APPROVED,
            LOAN_APPLICATION_AUDIT_ACTIONS.DECLINED,
            LOAN_AUDIT_ACTIONS.RENEW_APPLICATION_CREATED,
            LOAN_AUDIT_ACTIONS.DUPLICATE_APPLICATION_CREATED,
          ],
        },
      },
      _count: { _all: true },
    });

    const countByAction = new Map(
      groups.map((group) => [group.action, group._count._all]),
    );
    const submittedCount =
      (countByAction.get(LOAN_APPLICATION_AUDIT_ACTIONS.CREATED) ?? 0) +
      (countByAction.get(LOAN_AUDIT_ACTIONS.RENEW_APPLICATION_CREATED) ?? 0) +
      (countByAction.get(LOAN_AUDIT_ACTIONS.DUPLICATE_APPLICATION_CREATED) ??
        0);
    const approvedCount =
      countByAction.get(LOAN_APPLICATION_AUDIT_ACTIONS.APPROVED) ?? 0;
    const rejectedCount =
      countByAction.get(LOAN_APPLICATION_AUDIT_ACTIONS.DECLINED) ?? 0;
    const approvalRatePercentage =
      submittedCount === 0
        ? 0
        : Math.round((approvedCount / submittedCount) * 1000) / 10;

    return {
      submittedCount,
      approvedCount,
      rejectedCount,
      approvalRatePercentage,
    };
  }

  async findOne(
    tenantId: string,
    id: number,
  ): Promise<LoanApplicationDetailResponse> {
    const application = await this.assertApplicationInTenant(tenantId, id);
    return this.toDetailResponse(application, { includeReviewed: true });
  }

  async markReviewed(
    tenantId: string,
    id: number,
    auditContext: AuditContext,
  ): Promise<LoanApplicationResponse> {
    await this.assertApplicationInTenant(tenantId, id);

    const updated = await this.prisma.loanApplication.update({
      where: { id },
      data: { isReviewed: true },
      select: APPLICATION_SELECT,
    });

    this.emitAudit(auditContext, {
      action: LOAN_APPLICATION_AUDIT_ACTIONS.MARKED_REVIEWED,
      targetId: String(id),
    });

    return this.toResponse(updated, { includeReviewed: true });
  }

  async decline(
    tenantId: string,
    id: number,
    handlerId: number,
    auditContext: AuditContext,
  ): Promise<void> {
    const application = await this.assertApplicationInTenant(tenantId, id);
    const applicant = application.users;

    await this.prisma.$transaction(async (tx) => {
      if (application.specialOfferId) {
        await this.specialOffersService.releaseReservation(
          application.specialOfferId,
          application.applicantId,
          tx,
        );
      }

      await tx.loanApplication.delete({ where: { id } });

      await this.customerLoanActivityService.recordApplicationDeclined(
        application.applicantId,
        application.tenantId,
        tx,
      );
    });

    await this.imageStorage.deleteIfExists(application.collateralImageUrl);

    this.notificationsService.push({
      targetUser: application.applicantId,
      type: NOTIFICATION_TYPES.INFO,
      content: `Dear ${applicant.fullname}, your loan application has been declined. Please contact us for more information.`,
    });

    if (applicant.email) {
      const brandName = await this.tenantBrandNameService.resolveDisplayName(
        application.tenantId,
      );
      const emailContent = buildLoanApplicationDeclinedEmail({
        fullname: applicant.fullname,
        brandName,
        loanAmount: application.loanAmount,
        numWeeks: application.numWeeks,
      });
      void this.emailService.send({
        to: applicant.email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });
    }

    this.emitAudit(auditContext, {
      action: LOAN_APPLICATION_AUDIT_ACTIONS.DECLINED,
      targetId: String(id),
      payload: {
        applicantId: application.applicantId,
        handlerId,
        loanAmount: application.loanAmount,
      },
    });
  }

  async removeByStaff(
    tenantId: string,
    id: number,
    auditContext: AuditContext,
  ): Promise<void> {
    const application = await this.assertApplicationInTenant(tenantId, id);

    await this.prisma.$transaction(async (tx) => {
      if (application.specialOfferId) {
        await this.specialOffersService.releaseReservation(
          application.specialOfferId,
          application.applicantId,
          tx,
        );
      }

      await tx.loanApplication.delete({ where: { id } });
    });

    await this.imageStorage.deleteIfExists(application.collateralImageUrl);

    this.emitAudit(auditContext, {
      action: LOAN_APPLICATION_AUDIT_ACTIONS.DELETED,
      targetId: String(id),
      payload: {
        applicantId: application.applicantId,
        mode: 'staff',
      },
    });
  }

  async approve(
    tenantId: string,
    id: number,
    handlerId: number,
    auditContext: AuditContext,
  ): Promise<ApproveLoanApplicationResponse> {
    const application = await this.assertApplicationInTenant(tenantId, id);
    assertStaffTenantMatchesRecord(tenantId, application.tenantId);

    await this.loanProvisionEligibilityValidator.assertLoanProvisionEligibility(
      application.applicantId,
      handlerId,
    );

    if (!application.collateral?.trim()) {
      throw new BadRequestException(
        'Collateral is required before a loan application can be approved',
      );
    }

    if (
      application.loanTypeId == null ||
      application.interestRate == null ||
      application.expectedReturnAmount == null
    ) {
      throw new BadRequestException(
        'This application is missing rate snapshots. Ask the customer to update it before approval.',
      );
    }

    if (application.specialOfferId) {
      await this.specialOffersService.assertReservedOfferForApplicant(
        application.specialOfferId,
        application.applicantId,
      );
    }

    const loanTypeId = application.loanTypeId;
    const interestRate = application.interestRate;
    const returnAmount = application.expectedReturnAmount;

    const loanType = await this.prisma.loanType.findUnique({
      where: { loanTypeId },
      select: { tenantId: true, typeName: true },
    });

    if (!loanType) {
      throw new NotFoundException(`Loan type ${loanTypeId} was not found`);
    }

    assertLoanTypeBelongsToTenant(loanType.tenantId, application.tenantId);

    const loan = await this.prisma.$transaction(async (tx) => {
      const createdLoan = await this.loansService.createFromApprovedApplication(
        {
          tenantId: application.tenantId,
          customerId: application.applicantId,
          handlerId,
          loanTypeId,
          loanAmount: application.loanAmount,
          returnAmount,
          interestRate,
          numWeeks: application.numWeeks,
          collateral: application.collateral!,
          collateralImageUrl: application.collateralImageUrl,
        },
        tx,
      );

      if (application.specialOfferId) {
        await this.specialOffersService.redeemReservedOffer(
          application.specialOfferId,
          createdLoan.loanId,
          application.applicantId,
          auditContext,
          tx,
        );
      }

      await tx.loanApplication.delete({ where: { id } });

      await this.customerLoanActivityService.recordApplicationApproved(
        application.applicantId,
        application.tenantId,
        tx,
      );

      return createdLoan;
    });

    const applicant = application.users;

    this.notificationsService.push({
      targetUser: application.applicantId,
      type: NOTIFICATION_TYPES.INFO,
      content: `Congratulations ${applicant.fullname}, your loan application has been approved. The loan amount is ${formatCurrency(application.loanAmount)}. Thank you.`,
    });

    if (applicant.email) {
      const brandName = await this.tenantBrandNameService.resolveDisplayName(
        application.tenantId,
      );
      const emailContent = buildLoanApplicationApprovedEmail({
        fullname: applicant.fullname,
        brandName,
        loanAmount: application.loanAmount,
        returnAmount,
        interestRate,
        numWeeks: application.numWeeks,
        startDate: loan.startDate,
        endDate: loan.endDate,
        loanTypeName: loanType.typeName,
      });
      void this.emailService.send({
        to: applicant.email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });
    }

    this.auditEmitter.emitRelated(
      {
        ...auditContext,
        tenantId: application.tenantId,
        module: 'LOAN_APPLICATIONS',
        targetType: 'LoanApplication',
        action: LOAN_APPLICATION_AUDIT_ACTIONS.APPROVED,
        targetId: String(id),
        payload: {
          loanId: loan.publicId,
          applicantId: application.applicantId,
          handlerId,
          loanAmount: application.loanAmount,
          returnAmount,
          interestRate,
          specialOfferId: application.specialOfferId,
        },
      },
      {
        module: 'LOANS',
        action: LOAN_AUDIT_ACTIONS.APPROVED,
        targetType: 'Loan',
        targetId: loan.publicId,
        payload: {
          applicationId: id,
          applicantId: application.applicantId,
          handlerId,
          loanAmount: application.loanAmount,
          returnAmount,
          interestRate,
          origin: 'approval',
        },
      },
    );

    return {
      loanId: loan.publicId,
      customer: {
        userId: applicant.userId,
        fullname: applicant.fullname,
        email: applicant.email,
      },
    };
  }

  private async assertOwnedApplication(
    id: number,
    applicantId: number,
  ): Promise<ApplicationWithRelations> {
    const application = await this.prisma.loanApplication.findFirst({
      where: { id, applicantId },
      select: APPLICATION_SELECT,
    });

    if (!application) {
      throw new NotFoundException(`Loan application ${id} was not found`);
    }

    return application;
  }

  private async assertApplicationInTenant(
    tenantId: string,
    id: number,
  ): Promise<ApplicationWithRelations> {
    const application = await this.assertApplicationExists(id);
    assertStaffTenantMatchesRecord(
      tenantId,
      application.tenantId,
      `Loan application ${id} was not found`,
    );
    return application;
  }

  private async assertApplicationExists(
    id: number,
  ): Promise<ApplicationWithRelations> {
    const application = await this.prisma.loanApplication.findUnique({
      where: { id },
      select: APPLICATION_SELECT,
    });

    if (!application) {
      throw new NotFoundException(`Loan application ${id} was not found`);
    }

    return application;
  }

  private toResponse(
    application: ApplicationWithRelations,
    options: { includeReviewed: boolean },
  ): LoanApplicationResponse {
    const brandProfile = application.tenant.brandProfile;
    const response: LoanApplicationResponse = {
      id: application.id,
      tenantId: application.tenantId,
      applicantId: application.users.userId,
      loanAmount: application.loanAmount,
      collateral: application.collateral,
      collateralImageUrl: application.collateralImageUrl,
      numWeeks: application.numWeeks,
      location: application.location,
      dateApplied: application.dateApplied,
      discount: application.discount,
      specialOfferId: application.specialOfferId,
      specialOffer: application.specialOffer
        ? {
            id: application.specialOffer.id,
            discountType: application.specialOffer.discountType,
            discountValue: Number(application.specialOffer.discountValue),
            status: application.specialOffer.status,
          }
        : null,
      applicant: {
        userId: application.users.userId,
        fullname: application.users.fullname,
        email: application.users.email,
      },
      issuingBrand: {
        tenantId: application.tenant.tenantId,
        name: application.tenant.name,
        logoUrl: resolveTenantLogoUrl({
          logoUrl: application.tenant.logoUrl,
          logoImgName: brandProfile?.logoImgName,
        }),
        brandColor: application.tenant.brandColor,
        brandName: brandProfile?.brandName ?? null,
        slogan: brandProfile?.slogan ?? null,
        logoImgName: brandProfile?.logoImgName ?? null,
      },
    };

    if (options.includeReviewed) {
      response.isReviewed = application.isReviewed;
    }

    return response;
  }

  /**
   * Detail uses frozen snapshots only — never re-queries InterestRate.
   */
  private toDetailResponse(
    application: ApplicationWithRelations,
    options: { includeReviewed: boolean },
  ): LoanApplicationDetailResponse {
    const base = this.toResponse(application, options);

    return {
      ...base,
      activeRate: application.activeRate,
      interestRate: application.interestRate,
      expectedReturnAmount: application.expectedReturnAmount,
    };
  }

  private async resolveLoanTypeName(
    loanTypeId: number | null,
  ): Promise<string | undefined> {
    if (loanTypeId == null) {
      return undefined;
    }

    const loanType = await this.prisma.loanType.findUnique({
      where: { loanTypeId },
      select: { typeName: true },
    });

    return loanType?.typeName;
  }

  /** Resolve catalog once at write time and freeze money fields onto the application. */
  private async resolveRateSnapshot(
    tenantId: string,
    loanAmount: number,
    numWeeks: number,
    offer: OfferDiscountInput | null,
  ) {
    const rateRecord = await this.interestRatesService.findByNumWeeks(
      tenantId,
      numWeeks,
    );

    return buildApplicationRateSnapshot({
      loanTypeId: rateRecord.loanTypeId,
      activeRate: rateRecord.activeRate,
      loanAmount,
      offer,
    });
  }

  /**
   * Validate offer belongs to the application tenant, then reserve.
   * Cross-tenant offers are rejected before reservation mutates status.
   */
  private async reserveOfferForTenant(
    offerId: number,
    applicantId: number,
    tenantId: string,
    db: Prisma.TransactionClient,
  ) {
    const snapshot =
      await this.specialOffersService.validateForApplicationAttachment(
        offerId,
        applicantId,
        db,
      );

    if (snapshot.tenantId !== tenantId) {
      throw new BadRequestException(
        'Special offer does not belong to the selected financial institution',
      );
    }

    return this.specialOffersService.reserveForApplication(
      offerId,
      applicantId,
      db,
    );
  }

  private async resolveUserHandle(id: number): Promise<string> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: { userId: true },
    });

    if (!user) {
      throw new NotFoundException(`User ${id} was not found`);
    }

    return user.userId;
  }

  private async resolveStatusVisibilityByTenant(
    tenantIds: string[],
  ): Promise<Map<string, boolean>> {
    const uniqueTenantIds = [...new Set(tenantIds)];
    const visibility = new Map<string, boolean>();

    await Promise.all(
      uniqueTenantIds.map(async (tenantId) => {
        const visible =
          await this.loanApplicationSettingsService.isApplicationStatusVisibleToApplicant(
            tenantId,
          );
        visibility.set(tenantId, visible);
      }),
    );

    return visibility;
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
      module: 'LOAN_APPLICATIONS',
      targetType: 'LoanApplication',
      ...params,
    });
  }
}
