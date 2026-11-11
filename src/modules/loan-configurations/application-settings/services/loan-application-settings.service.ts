import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { formatCurrency } from '../../../../common/utils/format-currency.util';
import type { AuditContext } from '../../../../core/audit/interfaces/audit-payload.interface';
import { AuditEmitterService } from '../../../../core/audit/services/audit-emitter.service';
import { PrismaService } from '../../../../core/database/prisma.service';
import { LOAN_APPLICATION_SETTINGS_AUDIT_ACTIONS } from '../constants/loan-application-settings-audit-actions.constant';
import { UpdateLoanApplicationSettingsDto } from '../dto/update-loan-application-settings.dto';

const SETTINGS_SELECT = {
  id: true,
  tenantId: true,
  applicationStatusVisibleToApplicant: true,
  minLoanAmount: true,
  maxLoanAmount: true,
  updatedAt: true,
} as const;

export interface LoanApplicationSettingsResponse {
  id: number;
  applicationStatusVisibleToApplicant: boolean;
  minLoanAmount: number;
  maxLoanAmount: number;
  updatedAt: Date;
}

/** Amount bounds for authenticated customer apply/edit forms. */
export interface LoanAmountLimitsResponse {
  minLoanAmount: number;
  maxLoanAmount: number;
}

@Injectable()
export class LoanApplicationSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditEmitter: AuditEmitterService,
  ) {}

  async ensureDefaults(tenantId: string): Promise<void> {
    await this.prisma.loanApplicationSetting.upsert({
      where: { tenantId },
      update: {},
      create: {
        tenantId,
        applicationStatusVisibleToApplicant: false,
        minLoanAmount: 10000,
        maxLoanAmount: 1000000,
      },
    });
  }

  async getSettings(tenantId: string): Promise<LoanApplicationSettingsResponse> {
    return this.assertSettingsExist(tenantId);
  }

  async getAmountLimits(
    tenantId: string,
  ): Promise<LoanAmountLimitsResponse> {
    const settings = await this.assertSettingsExist(tenantId);
    return {
      minLoanAmount: settings.minLoanAmount,
      maxLoanAmount: settings.maxLoanAmount,
    };
  }

  async isApplicationStatusVisibleToApplicant(
    tenantId: string,
  ): Promise<boolean> {
    const settings = await this.assertSettingsExist(tenantId);
    return settings.applicationStatusVisibleToApplicant;
  }

  /**
   * Rejects amounts outside the configured inclusive [min, max] range.
   * Call before persisting customer applications (create / update / from-loan).
   */
  async assertLoanAmountWithinLimits(
    tenantId: string,
    loanAmount: number,
  ): Promise<void> {
    const settings = await this.assertSettingsExist(tenantId);

    if (
      loanAmount < settings.minLoanAmount ||
      loanAmount > settings.maxLoanAmount
    ) {
      throw new BadRequestException(
        `Loan amount must be between ${formatCurrency(settings.minLoanAmount)} and ${formatCurrency(settings.maxLoanAmount)}`,
      );
    }
  }

  async updateSettings(
    tenantId: string,
    dto: UpdateLoanApplicationSettingsDto,
    auditContext: AuditContext,
  ): Promise<LoanApplicationSettingsResponse> {
    const existing = await this.assertSettingsExist(tenantId);

    if (
      dto.applicationStatusVisibleToApplicant === undefined &&
      dto.minLoanAmount === undefined &&
      dto.maxLoanAmount === undefined
    ) {
      throw new BadRequestException('At least one settings field is required');
    }

    const nextMin = dto.minLoanAmount ?? existing.minLoanAmount;
    const nextMax = dto.maxLoanAmount ?? existing.maxLoanAmount;

    if (nextMin > nextMax) {
      throw new BadRequestException(
        'minLoanAmount cannot be greater than maxLoanAmount',
      );
    }

    const updated = await this.prisma.loanApplicationSetting.update({
      where: { tenantId },
      data: {
        ...(dto.applicationStatusVisibleToApplicant !== undefined
          ? {
              applicationStatusVisibleToApplicant:
                dto.applicationStatusVisibleToApplicant,
            }
          : {}),
        ...(dto.minLoanAmount !== undefined
          ? { minLoanAmount: dto.minLoanAmount }
          : {}),
        ...(dto.maxLoanAmount !== undefined
          ? { maxLoanAmount: dto.maxLoanAmount }
          : {}),
      },
      select: SETTINGS_SELECT,
    });

    this.auditEmitter.emit({
      ...auditContext,
      tenantId,
      module: 'LOAN_CONFIGURATIONS',
      action: LOAN_APPLICATION_SETTINGS_AUDIT_ACTIONS.UPDATED,
      targetId: String(updated.id),
      targetType: 'LoanApplicationSetting',
      payload: { ...dto },
    });

    return this.toResponse(updated);
  }

  private async assertSettingsExist(
    tenantId: string,
  ): Promise<LoanApplicationSettingsResponse> {
    const settings = await this.prisma.loanApplicationSetting.findUnique({
      where: { tenantId },
      select: SETTINGS_SELECT,
    });

    if (!settings) {
      throw new NotFoundException(
        'Loan application settings are missing for this tenant. Provision defaults during tenant onboarding.',
      );
    }

    return this.toResponse(settings);
  }

  private toResponse(settings: {
    id: number;
    applicationStatusVisibleToApplicant: boolean;
    minLoanAmount: number;
    maxLoanAmount: number;
    updatedAt: Date;
  }): LoanApplicationSettingsResponse {
    return {
      id: settings.id,
      applicationStatusVisibleToApplicant:
        settings.applicationStatusVisibleToApplicant,
      minLoanAmount: settings.minLoanAmount,
      maxLoanAmount: settings.maxLoanAmount,
      updatedAt: settings.updatedAt,
    };
  }
}
