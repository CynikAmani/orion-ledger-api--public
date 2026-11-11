import { Injectable } from '@nestjs/common';
import {
  ApprovalRequestStatus,
  OnboardingRequestStatus,
  Prisma,
  SubscriptionStatus,
  SupportTicketStatus,
} from '@prisma/client';
import type { UtcDateWindow } from '../../../../common/utils/format-date.util';
import { PrismaService } from '../../../../core/database/prisma.service';
import { PERMISSIONS } from '../../../auth/shared/constants/permissions.constant';
import { CUSTOMER_ROLE_KEY } from '../../../auth/shared/constants/roles.constant';
import type { AuthenticatedUser } from '../../../auth/shared/types/authenticated-user.type';
import { PLATFORM_PRODUCTION_TENANT_WHERE } from '../../../tenants/shared/utils/platform-production-tenant.util';
import {
  PLATFORM_DASHBOARD_DEFAULT_RANKING_LIMIT,
  PLATFORM_DASHBOARD_DEFAULT_TIMEFRAME,
  resolvePlatformTimeframeWindow,
  type PlatformDashboardRankingLimit,
  type PlatformDashboardTimeframe,
} from '../constants/platform-dashboard.constant';

export interface PlatformDashboardUserCounts {
  totalCustomers: number;
  totalPlatformStaff: number;
  totalSystemUsers: number;
  totalBlockedUsers: number;
}

export interface PlatformDashboardTenantStats {
  totalOnboarded: number;
  activeSubscribed: number;
  activeOnTrial: number;
  expiredOrInactive: number;
}

export interface PlatformDashboardQueues {
  pendingApprovalRequestsCount: number;
  openSupportTicketsCount: number;
  /** PENDING brand onboarding requests awaiting platform review/approve. */
  pendingBrandOnboardingRequestsCount: number;
}

export interface PlatformDashboardUsageMetrics {
  timeframe: PlatformDashboardTimeframe;
  periodStartInclusive: Date | null;
  periodEndExclusive: Date | null;
  totalLoanApplications: number;
  totalLoansIssued: number;
}

export interface PlatformTenantVolumeRankRow {
  tenantUuid: string;
  name: string;
  slug: string;
  tenantCode: string;
  count: number;
}

export interface PlatformDashboardRankingsMetrics {
  timeframe: PlatformDashboardTimeframe;
  limit: PlatformDashboardRankingLimit;
  periodStartInclusive: Date | null;
  periodEndExclusive: Date | null;
  trendingTenantsByApplications: PlatformTenantVolumeRankRow[];
  topTenantsByLoansIssued: PlatformTenantVolumeRankRow[];
}

export interface PlatformDashboardOverviewResponse {
  generatedAt: Date;
  /** Null when caller lacks platform:platform-dashboard:users. */
  users: PlatformDashboardUserCounts | null;
  /** Null when caller lacks platform:platform-dashboard:tenants. */
  tenantStats: PlatformDashboardTenantStats | null;
  /** Null when caller lacks platform:platform-dashboard:queues. */
  queues: PlatformDashboardQueues | null;
  /** Null when caller lacks platform:platform-dashboard:usage. Default period: this_month. */
  usage: PlatformDashboardUsageMetrics | null;
  /** Null when caller lacks platform:platform-dashboard:rankings. Default: this_month, limit 5. */
  rankings: PlatformDashboardRankingsMetrics | null;
}

const activeCustomerRoleFilter: Prisma.UserRoleListRelationFilter = {
  some: {
    role: {
      key: CUSTOMER_ROLE_KEY,
      tenantId: null,
    },
  },
};

@Injectable()
export class PlatformDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(
    user: AuthenticatedUser,
  ): Promise<PlatformDashboardOverviewResponse> {
    const permissions = user.permissions ?? [];

    const canUsers = this.has(permissions, PERMISSIONS.PLATFORM_DASHBOARD.USERS);
    const canTenants = this.has(
      permissions,
      PERMISSIONS.PLATFORM_DASHBOARD.TENANTS,
    );
    const canQueues = this.has(
      permissions,
      PERMISSIONS.PLATFORM_DASHBOARD.QUEUES,
    );
    const canUsage = this.has(permissions, PERMISSIONS.PLATFORM_DASHBOARD.USAGE);
    const canRankings = this.has(
      permissions,
      PERMISSIONS.PLATFORM_DASHBOARD.RANKINGS,
    );

    const [users, tenantStats, queues, usage, rankings] = await Promise.all([
      canUsers ? this.getUserCounts() : Promise.resolve(null),
      canTenants ? this.getTenantStats() : Promise.resolve(null),
      canQueues ? this.getQueues() : Promise.resolve(null),
      canUsage
        ? this.getUsage(PLATFORM_DASHBOARD_DEFAULT_TIMEFRAME)
        : Promise.resolve(null),
      canRankings
        ? this.getRankings(
            PLATFORM_DASHBOARD_DEFAULT_TIMEFRAME,
            PLATFORM_DASHBOARD_DEFAULT_RANKING_LIMIT,
          )
        : Promise.resolve(null),
    ]);

    return {
      generatedAt: new Date(),
      users,
      tenantStats,
      queues,
      usage,
      rankings,
    };
  }

  async getUsage(
    timeframe: PlatformDashboardTimeframe = PLATFORM_DASHBOARD_DEFAULT_TIMEFRAME,
  ): Promise<PlatformDashboardUsageMetrics> {
    const window = resolvePlatformTimeframeWindow(timeframe);
    const applicationWhere = this.applicationPeriodWhere(window);
    const loanWhere = this.loanPeriodWhere(window);

    const [totalLoanApplications, totalLoansIssued] = await Promise.all([
      this.prisma.loanApplication.count({
        where: {
          ...applicationWhere,
          tenant: PLATFORM_PRODUCTION_TENANT_WHERE,
        },
      }),
      this.prisma.loan.count({
        where: {
          ...loanWhere,
          tenant: PLATFORM_PRODUCTION_TENANT_WHERE,
        },
      }),
    ]);

    return {
      timeframe,
      periodStartInclusive: window?.start ?? null,
      periodEndExclusive: window?.endExclusive ?? null,
      totalLoanApplications,
      totalLoansIssued,
    };
  }

  async getRankings(
    timeframe: PlatformDashboardTimeframe = PLATFORM_DASHBOARD_DEFAULT_TIMEFRAME,
    limit: PlatformDashboardRankingLimit = PLATFORM_DASHBOARD_DEFAULT_RANKING_LIMIT,
  ): Promise<PlatformDashboardRankingsMetrics> {
    const window = resolvePlatformTimeframeWindow(timeframe);

    const [applicationGroups, loanGroups] = await Promise.all([
      this.prisma.loanApplication.groupBy({
        by: ['tenantId'],
        where: {
          ...this.applicationPeriodWhere(window),
          tenant: PLATFORM_PRODUCTION_TENANT_WHERE,
        },
        _count: { _all: true },
        orderBy: { _count: { tenantId: 'desc' } },
        take: limit,
      }),
      this.prisma.loan.groupBy({
        by: ['tenantId'],
        where: {
          ...this.loanPeriodWhere(window),
          tenant: PLATFORM_PRODUCTION_TENANT_WHERE,
        },
        _count: { _all: true },
        orderBy: { _count: { tenantId: 'desc' } },
        take: limit,
      }),
    ]);

    const tenantIds = [
      ...new Set([
        ...applicationGroups.map((row) => row.tenantId),
        ...loanGroups.map((row) => row.tenantId),
      ]),
    ];

    const tenants =
      tenantIds.length === 0
        ? []
        : await this.prisma.tenant.findMany({
            where: {
              tenantId: { in: tenantIds },
              ...PLATFORM_PRODUCTION_TENANT_WHERE,
            },
            select: {
              tenantId: true,
              name: true,
              slug: true,
              tenantCode: true,
            },
          });

    const tenantById = new Map(
      tenants.map((tenant) => [tenant.tenantId, tenant]),
    );

    return {
      timeframe,
      limit,
      periodStartInclusive: window?.start ?? null,
      periodEndExclusive: window?.endExclusive ?? null,
      trendingTenantsByApplications: this.mapRankRows(
        applicationGroups,
        tenantById,
      ),
      topTenantsByLoansIssued: this.mapRankRows(loanGroups, tenantById),
    };
  }

  private has(permissions: string[], permission: string): boolean {
    return permissions.includes(permission);
  }

  private async getUserCounts(): Promise<PlatformDashboardUserCounts> {
    /** Platform users + staff of production tenants only (demo staff are ghosts). */
    const nonDemoUserWhere: Prisma.UserWhereInput = {
      deletedAt: null,
      OR: [{ tenantId: null }, { tenant: PLATFORM_PRODUCTION_TENANT_WHERE }],
    };

    const [
      totalCustomers,
      totalPlatformStaff,
      totalSystemUsers,
      totalBlockedUsers,
    ] = await Promise.all([
      this.prisma.user.count({
        where: {
          tenantId: null,
          deletedAt: null,
          userRoles: activeCustomerRoleFilter,
        },
      }),
      this.prisma.user.count({
        where: {
          tenantId: null,
          deletedAt: null,
          NOT: { userRoles: activeCustomerRoleFilter },
        },
      }),
      this.prisma.user.count({ where: nonDemoUserWhere }),
      this.prisma.user.count({
        where: { ...nonDemoUserWhere, isBlocked: true },
      }),
    ]);

    return {
      totalCustomers,
      totalPlatformStaff,
      totalSystemUsers,
      totalBlockedUsers,
    };
  }

  private async getTenantStats(): Promise<PlatformDashboardTenantStats> {
    const [
      totalOnboarded,
      activeSubscribed,
      activeOnTrial,
      expiredOrInactive,
    ] = await Promise.all([
      this.prisma.tenant.count({ where: PLATFORM_PRODUCTION_TENANT_WHERE }),
      this.prisma.tenant.count({
        where: {
          ...PLATFORM_PRODUCTION_TENANT_WHERE,
          isActive: true,
          subscriptionStatus: SubscriptionStatus.PAID,
        },
      }),
      this.prisma.tenant.count({
        where: {
          ...PLATFORM_PRODUCTION_TENANT_WHERE,
          isActive: true,
          subscriptionStatus: SubscriptionStatus.TRIAL,
        },
      }),
      this.prisma.tenant.count({
        where: {
          ...PLATFORM_PRODUCTION_TENANT_WHERE,
          OR: [
            { subscriptionStatus: SubscriptionStatus.EXPIRED },
            { isActive: false },
          ],
        },
      }),
    ]);

    return {
      totalOnboarded,
      activeSubscribed,
      activeOnTrial,
      expiredOrInactive,
    };
  }

  private async getQueues(): Promise<PlatformDashboardQueues> {
    // Operational queues stay inclusive of demo tenants so staff can act on them.
    const [
      pendingApprovalRequestsCount,
      openSupportTicketsCount,
      pendingBrandOnboardingRequestsCount,
    ] = await Promise.all([
      this.prisma.approvalRequest.count({
        where: { status: ApprovalRequestStatus.PENDING },
      }),
      this.prisma.supportTicket.count({
        where: {
          status: {
            in: [SupportTicketStatus.OPEN, SupportTicketStatus.IN_PROGRESS],
          },
        },
      }),
      this.prisma.brandOnboardingRequest.count({
        where: { status: OnboardingRequestStatus.PENDING },
      }),
    ]);

    return {
      pendingApprovalRequestsCount,
      openSupportTicketsCount,
      pendingBrandOnboardingRequestsCount,
    };
  }

  private applicationPeriodWhere(
    window: UtcDateWindow | null,
  ): Prisma.LoanApplicationWhereInput {
    if (!window) {
      return {};
    }

    return {
      dateApplied: { gte: window.start, lt: window.endExclusive },
    };
  }

  private loanPeriodWhere(window: UtcDateWindow | null): Prisma.LoanWhereInput {
    if (!window) {
      return {};
    }

    return {
      startDate: { gte: window.start, lt: window.endExclusive },
    };
  }

  private mapRankRows(
    groups: Array<{ tenantId: string; _count: { _all: number } }>,
    tenantById: Map<
      string,
      { tenantId: string; name: string; slug: string; tenantCode: string }
    >,
  ): PlatformTenantVolumeRankRow[] {
    const rows: PlatformTenantVolumeRankRow[] = [];

    for (const group of groups) {
      const tenant = tenantById.get(group.tenantId);
      if (!tenant) {
        continue;
      }

      rows.push({
        tenantUuid: tenant.tenantId,
        name: tenant.name,
        slug: tenant.slug,
        tenantCode: tenant.tenantCode,
        count: group._count._all,
      });
    }

    return rows;
  }
}
