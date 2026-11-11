import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuditContext } from '../../../../core/audit/interfaces/audit-payload.interface';
import { AuditEmitterService } from '../../../../core/audit/services/audit-emitter.service';
import { PrismaService } from '../../../../core/database/prisma.service';
import { TenantLoanApplicationEligibilityService } from '../../../tenants/shared/services/tenant-loan-application-eligibility.service';
import { ListInterestRatesQueryDto } from '../dto/list-interest-rates-query.dto';
import { SaveInterestRatesDto } from '../dto/save-interest-rates.dto';
import { UpdateInterestRateDto } from '../dto/update-interest-rate.dto';

const INTEREST_RATE_SELECT = {
  rateId: true,
  loanTypeId: true,
  numWeeks: true,
  activeRate: true,
  standardRate: true,
} as const;

export interface InterestRateResponse {
  rateId: number;
  loanTypeId: number;
  numWeeks: number;
  activeRate: number;
  standardRate: number;
}

@Injectable()
export class InterestRatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditEmitter: AuditEmitterService,
    private readonly eligibility: TenantLoanApplicationEligibilityService,
  ) {}

  async create(
    tenantId: string,
    dto: SaveInterestRatesDto,
    auditContext: AuditContext,
  ): Promise<InterestRateResponse[]> {
    this.assertUniqueDurations(dto);
    await this.assertLoanTypesInTenant(tenantId, dto);
    await this.assertDurationsAreNew(tenantId, dto);

    const interestRates = await this.prisma.$transaction((tx) =>
      Promise.all(
        dto.rates.map((rate) =>
          tx.interestRate.create({
            data: {
              tenantId,
              loanTypeId: rate.loanTypeId,
              numWeeks: rate.numWeeks,
              activeRate: rate.activeRate,
              standardRate: rate.standardRate,
            },
            select: INTEREST_RATE_SELECT,
          }),
        ),
      ),
    );

    this.emitAudit(auditContext, tenantId, {
      action: 'INTEREST_RATES_CREATED',
      targetId: tenantId,
      payload: {
        count: interestRates.length,
        rateIds: interestRates.map((rate) => rate.rateId),
        rates: dto.rates,
      },
    });

    await this.eligibility.refresh(tenantId);

    return interestRates;
  }

  findAll(
    tenantId: string,
    query: ListInterestRatesQueryDto,
  ): Promise<InterestRateResponse[]> {
    const where: Prisma.InterestRateWhereInput = { tenantId };

    if (query.loanTypeId !== undefined) {
      where.loanTypeId = query.loanTypeId;
    }

    return this.prisma.interestRate.findMany({
      where,
      select: INTEREST_RATE_SELECT,
      orderBy: [{ loanTypeId: 'asc' }, { numWeeks: 'asc' }],
    });
  }

  async findOne(
    tenantId: string,
    rateId: number,
  ): Promise<InterestRateResponse> {
    return this.assertInterestRateExists(tenantId, rateId);
  }

  async findByNumWeeks(
    tenantId: string,
    numWeeks: number,
  ): Promise<InterestRateResponse> {
    const interestRate = await this.prisma.interestRate.findFirst({
      where: { tenantId, numWeeks },
      select: INTEREST_RATE_SELECT,
      orderBy: { rateId: 'asc' },
    });

    if (!interestRate) {
      throw new NotFoundException(
        `Interest rate for ${numWeeks} weeks was not found`,
      );
    }

    return interestRate;
  }

  /**
   * Product catalog row: loan type + duration.
   * Required when types can share `numWeeks` but differ in rate.
   */
  async findByLoanTypeAndNumWeeks(
    tenantId: string,
    loanTypeId: number,
    numWeeks: number,
  ): Promise<InterestRateResponse> {
    const interestRate = await this.prisma.interestRate.findFirst({
      where: { tenantId, loanTypeId, numWeeks },
      select: INTEREST_RATE_SELECT,
      orderBy: { rateId: 'asc' },
    });

    if (!interestRate) {
      throw new NotFoundException(
        `Interest rate for loan type ${loanTypeId} and ${numWeeks} weeks was not found`,
      );
    }

    return interestRate;
  }

  async update(
    tenantId: string,
    rateId: number,
    dto: UpdateInterestRateDto,
    auditContext: AuditContext,
  ): Promise<InterestRateResponse> {
    await this.assertInterestRateExists(tenantId, rateId);

    if (dto.loanTypeId !== undefined) {
      await this.assertLoanTypeInTenant(tenantId, dto.loanTypeId);
    }

    const interestRate = await this.prisma.interestRate.update({
      where: { rateId },
      data: dto,
      select: INTEREST_RATE_SELECT,
    });

    this.emitAudit(auditContext, tenantId, {
      action: 'INTEREST_RATE_UPDATED',
      targetId: String(rateId),
      payload: { ...dto },
    });

    await this.eligibility.refresh(tenantId);

    return interestRate;
  }

  async remove(
    tenantId: string,
    rateId: number,
    auditContext: AuditContext,
  ): Promise<void> {
    const existing = await this.assertInterestRateExists(tenantId, rateId);

    await this.prisma.interestRate.delete({
      where: { rateId },
    });

    this.emitAudit(auditContext, tenantId, {
      action: 'INTEREST_RATE_DELETED',
      targetId: String(rateId),
      payload: { ...existing },
    });

    await this.eligibility.refresh(tenantId);
  }

  private assertUniqueDurations(dto: SaveInterestRatesDto): void {
    const seen = new Set<string>();

    for (const rate of dto.rates) {
      const key = `${rate.loanTypeId}:${rate.numWeeks}`;
      if (seen.has(key)) {
        throw new BadRequestException(
          `Loan type ${rate.loanTypeId} already has a ${rate.numWeeks}-week rate in this save`,
        );
      }
      seen.add(key);
    }
  }

  private async assertLoanTypesInTenant(
    tenantId: string,
    dto: SaveInterestRatesDto,
  ): Promise<void> {
    const loanTypeIds = [...new Set(dto.rates.map((rate) => rate.loanTypeId))];
    const loanTypes = await this.prisma.loanType.findMany({
      where: { tenantId, loanTypeId: { in: loanTypeIds } },
      select: { loanTypeId: true },
    });
    const found = new Set(loanTypes.map((loanType) => loanType.loanTypeId));
    const missing = loanTypeIds.find((loanTypeId) => !found.has(loanTypeId));

    if (missing !== undefined) {
      throw new BadRequestException(
        `Loan type ${missing} does not belong to this tenant`,
      );
    }
  }

  private async assertDurationsAreNew(
    tenantId: string,
    dto: SaveInterestRatesDto,
  ): Promise<void> {
    const existing = await this.prisma.interestRate.findFirst({
      where: {
        tenantId,
        OR: dto.rates.map((rate) => ({
          loanTypeId: rate.loanTypeId,
          numWeeks: rate.numWeeks,
        })),
      },
      select: { loanTypeId: true, numWeeks: true },
    });

    if (existing) {
      throw new BadRequestException(
        `Loan type ${existing.loanTypeId} already has a ${existing.numWeeks}-week rate`,
      );
    }
  }

  private async assertLoanTypeInTenant(
    tenantId: string,
    loanTypeId: number,
  ): Promise<void> {
    const loanType = await this.prisma.loanType.findFirst({
      where: { tenantId, loanTypeId },
      select: { loanTypeId: true },
    });

    if (!loanType) {
      throw new BadRequestException(
        `Loan type ${loanTypeId} does not belong to this tenant`,
      );
    }
  }

  private emitAudit(
    auditContext: AuditContext,
    tenantId: string,
    params: { action: string; targetId: string; payload?: Record<string, unknown> },
  ): void {
    this.auditEmitter.emit({
      ...auditContext,
      tenantId,
      module: 'LOAN_CONFIGURATIONS',
      targetType: 'InterestRate',
      ...params,
    });
  }

  private async assertInterestRateExists(
    tenantId: string,
    rateId: number,
  ): Promise<InterestRateResponse> {
    const interestRate = await this.prisma.interestRate.findFirst({
      where: { tenantId, rateId },
      select: INTEREST_RATE_SELECT,
    });

    if (!interestRate) {
      throw new NotFoundException(
        `Interest rate with ID ${rateId} not found`,
      );
    }

    return interestRate;
  }
}
