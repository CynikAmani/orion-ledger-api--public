import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../core/database/prisma.service';
import { resolveTenantBrandName } from '../../../tenants/shared/utils/resolve-tenant-brand-name.util';
import { buildLoanDatasetFilename } from '../utils/loan-dataset-filename.util';
import {
  buildLoanDatasetWorkbook,
  type LoanDatasetRow,
} from '../utils/loan-dataset-sheet.util';

export type LoanDatasetDownload =
  | { kind: 'empty' }
  | { kind: 'file'; filename: string; body: Buffer };

@Injectable()
export class LoanDatasetService {
  constructor(private readonly prisma: PrismaService) {}

  async buildForTenant(tenantId: string): Promise<LoanDatasetDownload> {
    const loans = await this.prisma.loan.findMany({
      where: { tenantId },
      select: {
        publicId: true,
        loanAmount: true,
        returnAmount: true,
        interestRate: true,
        numWeeks: true,
        startDate: true,
        endDate: true,
        status: true,
        collateral: true,
        isCleared: true,
        customer: { select: { fullname: true } },
        handler: { select: { fullname: true } },
        loanTypes: { select: { typeName: true } },
      },
    });

    const rows: LoanDatasetRow[] = loans.map((loan) => ({
      reference: loan.publicId,
      borrower: loan.customer.fullname,
      loanType: loan.loanTypes.typeName,
      amount: loan.loanAmount,
      returnAmount: loan.returnAmount,
      interestRate: loan.interestRate,
      weeks: loan.numWeeks,
      startDate: loan.startDate,
      endDate: loan.endDate,
      status: loan.status,
      collateral: loan.collateral,
      cleared: loan.isCleared === true,
      issuedBy: loan.handler.fullname,
    }));

    if (rows.length === 0) {
      return { kind: 'empty' };
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { tenantId },
      select: {
        name: true,
        brandProfile: { select: { brandName: true } },
      },
    });

    return {
      kind: 'file',
      filename: buildLoanDatasetFilename(
        resolveTenantBrandName({
          tenantName: tenant?.name,
          brandName: tenant?.brandProfile?.brandName,
        }),
      ),
      body: await buildLoanDatasetWorkbook(rows),
    };
  }
}
