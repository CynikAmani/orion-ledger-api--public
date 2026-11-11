import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../core/database/prisma.service';

export interface CustomerLoanActivityResponse {
  customerId: string;
  tenantId?: string;
  totalApplications: number;
  activeLoansCount: number;
  clearedLoansCount: number;
  rejectedLoansCount: number;
  defaultedLoansCount: number;
  overdueClearedCount: number;
  loansSinceLastOffer: number;
  lastOfferIssuedAt: Date | null;
}

const EMPTY_ACTIVITY = {
  totalApplications: 0,
  activeLoansCount: 0,
  clearedLoansCount: 0,
  rejectedLoansCount: 0,
  defaultedLoansCount: 0,
  overdueClearedCount: 0,
  loansSinceLastOffer: 0,
  lastOfferIssuedAt: null,
} as const;

const ACTIVITY_SELECT = {
  customerId: true,
  totalApplications: true,
  activeLoansCount: true,
  clearedLoansCount: true,
  rejectedLoansCount: true,
  defaultedLoansCount: true,
  overdueClearedCount: true,
  loansSinceLastOffer: true,
  lastOfferIssuedAt: true,
} as const;

type DbClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class CustomerLoanActivityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Read-only loan activity snapshot for a customer.
   * `customerId` is the public handle. Returns zeroed counters when no row exists.
   */
  async getByCustomerId(
    customerHandle: string,
    tenantId?: string,
  ): Promise<CustomerLoanActivityResponse> {
    const customer = await this.assertCustomerExistsByHandle(customerHandle);

    const activities = await this.prisma.customerLoanActivity.findMany({
      where: { customerId: customer.id, ...(tenantId ? { tenantId } : {}) },
      select: ACTIVITY_SELECT,
    });

    if (activities.length === 0) {
      return {
        customerId: customer.userId,
        ...EMPTY_ACTIVITY,
      };
    }

    const initial: CustomerLoanActivityResponse = {
      customerId: customer.userId,
      ...EMPTY_ACTIVITY,
    };

    return activities.reduce<CustomerLoanActivityResponse>(
      (summary, activity) => ({
        ...summary,
        totalApplications: summary.totalApplications + activity.totalApplications,
        activeLoansCount: summary.activeLoansCount + activity.activeLoansCount,
        clearedLoansCount: summary.clearedLoansCount + activity.clearedLoansCount,
        rejectedLoansCount: summary.rejectedLoansCount + activity.rejectedLoansCount,
        defaultedLoansCount: summary.defaultedLoansCount + activity.defaultedLoansCount,
        overdueClearedCount: summary.overdueClearedCount + activity.overdueClearedCount,
        loansSinceLastOffer: summary.loansSinceLastOffer + activity.loansSinceLastOffer,
        lastOfferIssuedAt:
          summary.lastOfferIssuedAt && activity.lastOfferIssuedAt
            ? new Date(
                Math.max(
                  summary.lastOfferIssuedAt.getTime(),
                  activity.lastOfferIssuedAt.getTime(),
                ),
              )
            : summary.lastOfferIssuedAt ?? activity.lastOfferIssuedAt,
      }),
      initial,
    );
  }

  async recordApplicationSubmitted(
    customerId: number,
    tenantId: string,
    db: DbClient = this.prisma,
  ): Promise<void> {
    await this.ensureActivityRow(customerId, tenantId, db);
    await db.customerLoanActivity.update({
      where: { customerId_tenantId: { customerId, tenantId } },
      data: { totalApplications: { increment: 1 } },
    });
  }

  async recordApplicationApproved(
    customerId: number,
    tenantId: string,
    db: DbClient = this.prisma,
  ): Promise<void> {
    await this.ensureActivityRow(customerId, tenantId, db);
    await db.customerLoanActivity.update({
      where: { customerId_tenantId: { customerId, tenantId } },
      data: {
        activeLoansCount: { increment: 1 },
        loansSinceLastOffer: { increment: 1 },
      },
    });
  }

  async recordApplicationDeclined(
    customerId: number,
    tenantId: string,
    db: DbClient = this.prisma,
  ): Promise<void> {
    await this.ensureActivityRow(customerId, tenantId, db);
    await db.customerLoanActivity.update({
      where: { customerId_tenantId: { customerId, tenantId } },
      data: { rejectedLoansCount: { increment: 1 } },
    });
  }

  /**
   * Called by LoansService when an active loan is marked defaulted.
   * Moves one loan from the active pool into the defaulted counter.
   */
  async recordLoanDefaulted(
    customerId: number,
    tenantId: string,
    db: DbClient = this.prisma,
  ): Promise<void> {
    await this.ensureActivityRow(customerId, tenantId, db);
    await db.customerLoanActivity.update({
      where: { customerId_tenantId: { customerId, tenantId } },
      data: {
        defaultedLoansCount: { increment: 1 },
        activeLoansCount: { decrement: 1 },
      },
    });
  }

  /**
   * Direct issue / staff duplicate / renew-created loan (not via application approve).
   */
  async recordLoanIssued(
    customerId: number,
    tenantId: string,
    db: DbClient = this.prisma,
  ): Promise<void> {
    await this.ensureActivityRow(customerId, tenantId, db);
    await db.customerLoanActivity.update({
      where: { customerId_tenantId: { customerId, tenantId } },
      data: {
        activeLoansCount: { increment: 1 },
        loansSinceLastOffer: { increment: 1 },
      },
    });
  }

  /**
   * Called when a loan balance hits zero. `previousStatus` drives overdue/defaulted counters.
   */
  async recordLoanCleared(
    customerId: number,
    previousStatus: string,
    tenantId: string,
    db: DbClient = this.prisma,
  ): Promise<void> {
    await this.ensureActivityRow(customerId, tenantId, db);

    if (previousStatus === 'DEFAULTED') {
      await db.customerLoanActivity.update({
        where: { customerId_tenantId: { customerId, tenantId } },
        data: {
          clearedLoansCount: { increment: 1 },
          defaultedLoansCount: { decrement: 1 },
        },
      });
      return;
    }

    if (previousStatus === 'OVERDUE') {
      await db.customerLoanActivity.update({
        where: { customerId_tenantId: { customerId, tenantId } },
        data: {
          clearedLoansCount: { increment: 1 },
          activeLoansCount: { decrement: 1 },
          overdueClearedCount: { increment: 1 },
        },
      });
      return;
    }

    await db.customerLoanActivity.update({
      where: { customerId_tenantId: { customerId, tenantId } },
      data: {
        clearedLoansCount: { increment: 1 },
        activeLoansCount: { decrement: 1 },
      },
    });
  }

  private async ensureActivityRow(
    customerId: number,
    tenantId: string,
    db: DbClient,
  ): Promise<void> {
    await this.assertCustomerExistsById(customerId, db);

    await db.customerLoanActivity.upsert({
      where: { customerId_tenantId: { customerId, tenantId } },
      create: { customerId, tenantId },
      update: {},
    });
  }

  private async assertCustomerExistsByHandle(
    customerHandle: string,
    db: DbClient = this.prisma,
  ): Promise<{ id: number; userId: string }> {
    const customer = await db.user.findFirst({
      where: { userId: customerHandle, deletedAt: null },
      select: { id: true, userId: true },
    });

    if (!customer) {
      throw new NotFoundException(`Customer ${customerHandle} was not found`);
    }

    return customer;
  }

  private async assertCustomerExistsById(
    customerId: number,
    db: DbClient = this.prisma,
  ): Promise<void> {
    const customer = await db.user.findFirst({
      where: { id: customerId, deletedAt: null },
      select: { id: true },
    });

    if (!customer) {
      throw new NotFoundException(`Customer ${customerId} was not found`);
    }
  }
}
