import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CreateRepaymentDetailDto } from '../dto/create-repayment-detail.dto';
import { UpdateRepaymentDetailDto } from '../dto/update-repayment-detail.dto';

const REPAYMENT_DETAIL_SELECT = {
  repaymentDetailId: true,
  tenantId: true,
  paymentModeName: true,
  accountName: true,
  accountNumber: true,
} as const;

export interface RepaymentDetailResponse {
  repaymentDetailId: number;
  paymentModeName: string;
  accountName: string;
  accountNumber: string;
}

@Injectable()
export class RepaymentDetailsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    tenantId: string,
    dto: CreateRepaymentDetailDto,
  ): Promise<RepaymentDetailResponse> {
    const row = await this.prisma.repaymentDetail.create({
      data: {
        tenantId,
        paymentModeName: dto.paymentModeName,
        accountName: dto.accountName,
        accountNumber: dto.accountNumber,
      },
      select: REPAYMENT_DETAIL_SELECT,
    });

    return this.toResponse(row);
  }

  async findAll(tenantId: string): Promise<RepaymentDetailResponse[]> {
    const rows = await this.prisma.repaymentDetail.findMany({
      where: { tenantId },
      select: REPAYMENT_DETAIL_SELECT,
      orderBy: { repaymentDetailId: 'asc' },
    });

    return rows.map((row) => this.toResponse(row));
  }

  async findOne(
    tenantId: string,
    repaymentDetailId: number,
  ): Promise<RepaymentDetailResponse> {
    return this.assertRepaymentDetailExists(tenantId, repaymentDetailId);
  }

  async update(
    tenantId: string,
    repaymentDetailId: number,
    dto: UpdateRepaymentDetailDto,
  ): Promise<RepaymentDetailResponse> {
    await this.assertRepaymentDetailExists(tenantId, repaymentDetailId);

    const updated = await this.prisma.repaymentDetail.updateMany({
      where: { repaymentDetailId, tenantId },
      data: dto,
    });

    if (updated.count === 0) {
      throw new NotFoundException(
        `Repayment detail with ID ${repaymentDetailId} not found`,
      );
    }

    return this.assertRepaymentDetailExists(tenantId, repaymentDetailId);
  }

  async remove(tenantId: string, repaymentDetailId: number): Promise<void> {
    await this.assertRepaymentDetailExists(tenantId, repaymentDetailId);

    const deleted = await this.prisma.repaymentDetail.deleteMany({
      where: { repaymentDetailId, tenantId },
    });

    if (deleted.count === 0) {
      throw new NotFoundException(
        `Repayment detail with ID ${repaymentDetailId} not found`,
      );
    }
  }

  private async assertRepaymentDetailExists(
    tenantId: string,
    repaymentDetailId: number,
  ): Promise<RepaymentDetailResponse> {
    const repaymentDetail = await this.prisma.repaymentDetail.findFirst({
      where: { repaymentDetailId, tenantId },
      select: REPAYMENT_DETAIL_SELECT,
    });

    if (!repaymentDetail) {
      throw new NotFoundException(
        `Repayment detail with ID ${repaymentDetailId} not found`,
      );
    }

    return this.toResponse(repaymentDetail);
  }

  private toResponse(row: {
    repaymentDetailId: number;
    paymentModeName: string;
    accountName: string;
    accountNumber: string;
  }): RepaymentDetailResponse {
    return {
      repaymentDetailId: row.repaymentDetailId,
      paymentModeName: row.paymentModeName,
      accountName: row.accountName,
      accountNumber: row.accountNumber,
    };
  }
}
