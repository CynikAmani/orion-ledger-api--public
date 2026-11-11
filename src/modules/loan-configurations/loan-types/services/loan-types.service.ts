import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuditContext } from '../../../../core/audit/interfaces/audit-payload.interface';
import { AuditEmitterService } from '../../../../core/audit/services/audit-emitter.service';
import { PrismaService } from '../../../../core/database/prisma.service';
import { CreateLoanTypeDto } from '../dto/create-loan-type.dto';
import { UpdateLoanTypeDto } from '../dto/update-loan-type.dto';

const LOAN_TYPE_SELECT = {
  loanTypeId: true,
  typeName: true,
} as const;

const PUBLIC_LOAN_TYPE_SELECT = {
  loanTypeId: true,
  typeName: true,
  interestRates: {
    select: {
      rateId: true,
      numWeeks: true,
      activeRate: true,
      standardRate: true,
    },
    orderBy: { numWeeks: 'asc' as const },
  },
} as const;

export interface LoanTypeResponse {
  loanTypeId: number;
  typeName: string;
}

export interface PublicLoanTypeInterestRate {
  rateId: number;
  numWeeks: number;
  activeRate: number;
  standardRate: number;
}

/** Public portal payload — loan types with term rates for categorized display. */
export interface PublicLoanTypeResponse {
  loanTypeId: number;
  typeName: string;
  interestRates: PublicLoanTypeInterestRate[];
}

@Injectable()
export class LoanTypesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditEmitter: AuditEmitterService,
  ) {}

  async create(
    tenantId: string,
    dto: CreateLoanTypeDto,
    auditContext: AuditContext,
  ): Promise<LoanTypeResponse> {
    const loanType = await this.prisma.loanType.create({
      data: {
        tenantId,
        typeName: dto.typeName,
      },
      select: LOAN_TYPE_SELECT,
    });

    this.emitAudit(auditContext, tenantId, {
      action: 'LOAN_TYPE_CREATED',
      targetId: String(loanType.loanTypeId),
      payload: { ...dto },
    });

    return loanType;
  }

  findAll(tenantId: string): Promise<LoanTypeResponse[]> {
    return this.prisma.loanType.findMany({
      where: { tenantId },
      select: LOAN_TYPE_SELECT,
      orderBy: { loanTypeId: 'asc' },
    });
  }

  findPublic(tenantId: string): Promise<PublicLoanTypeResponse[]> {
    return this.prisma.loanType.findMany({
      where: { tenantId },
      select: PUBLIC_LOAN_TYPE_SELECT,
      orderBy: { loanTypeId: 'asc' },
    });
  }

  async findOne(
    tenantId: string,
    loanTypeId: number,
  ): Promise<LoanTypeResponse> {
    return this.assertLoanTypeExists(tenantId, loanTypeId);
  }

  async update(
    tenantId: string,
    loanTypeId: number,
    dto: UpdateLoanTypeDto,
    auditContext: AuditContext,
  ): Promise<LoanTypeResponse> {
    await this.assertLoanTypeExists(tenantId, loanTypeId);

    const loanType = await this.prisma.loanType.update({
      where: { loanTypeId },
      data: dto,
      select: LOAN_TYPE_SELECT,
    });

    this.emitAudit(auditContext, tenantId, {
      action: 'LOAN_TYPE_UPDATED',
      targetId: String(loanTypeId),
      payload: { ...dto },
    });

    return loanType;
  }

  async remove(
    tenantId: string,
    loanTypeId: number,
    auditContext: AuditContext,
  ): Promise<void> {
    const loanType = await this.prisma.loanType.findFirst({
      where: { tenantId, loanTypeId },
      select: {
        loanTypeId: true,
        typeName: true,
        _count: {
          select: {
            interestRates: true,
            loans: true,
          },
        },
      },
    });

    if (!loanType) {
      throw new NotFoundException(
        `Loan type with ID ${loanTypeId} not found`,
      );
    }

    const { interestRates: interestRateCount, loans: loanCount } =
      loanType._count;

    if (interestRateCount > 0 || loanCount > 0) {
      throw new ConflictException(
        `Cannot delete loan type ${loanTypeId} because it has ${interestRateCount} interest rate(s) and ${loanCount} loan(s)`,
      );
    }

    await this.prisma.loanType.delete({
      where: { loanTypeId },
    });

    this.emitAudit(auditContext, tenantId, {
      action: 'LOAN_TYPE_DELETED',
      targetId: String(loanTypeId),
      payload: { typeName: loanType.typeName },
    });
  }

  private emitAudit(
    auditContext: AuditContext,
    tenantId: string,
    params: {
      action: string;
      targetId: string;
      payload?: Record<string, unknown>;
    },
  ): void {
    this.auditEmitter.emit({
      ...auditContext,
      tenantId,
      module: 'LOAN_CONFIGURATIONS',
      targetType: 'LoanType',
      ...params,
    });
  }

  private async assertLoanTypeExists(
    tenantId: string,
    loanTypeId: number,
  ): Promise<LoanTypeResponse> {
    const loanType = await this.prisma.loanType.findFirst({
      where: { tenantId, loanTypeId },
      select: LOAN_TYPE_SELECT,
    });

    if (!loanType) {
      throw new NotFoundException(
        `Loan type with ID ${loanTypeId} not found`,
      );
    }

    return loanType;
  }
}
