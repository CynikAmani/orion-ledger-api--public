import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../core/database/prisma.service';
import { CUSTOMER_ROLE_KEY } from '../../../auth/shared/constants/roles.constant';
import { UserAccountLifecycleValidator } from '../../shared/validators/user-account-lifecycle.validator';

export interface ManagedUserContactDetails {
  userId: string;
  fullname: string;
  email: string | null;
  phone: string | null;
}

export const UNSPECIFIED_DEMOGRAPHIC_LABEL = 'Unspecified';

export interface CustomerDemographicCount {
  id: number | null;
  label: string;
  count: number;
}

export interface CustomerDemographicDistribution {
  total: number;
  buckets: CustomerDemographicCount[];
}

@Injectable()
export class ManagedUserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userAccountLifecycleValidator: UserAccountLifecycleValidator,
  ) {}

  async getContactDetails(userId: string): Promise<ManagedUserContactDetails> {
    await this.userAccountLifecycleValidator.getUserIfExists(userId);

    const user = await this.prisma.user.findUnique({
      where: { userId },
      select: {
        userId: true,
        fullname: true,
        email: true,
        phone: true,
      },
    });

    return user!;
  }

  async findContactDetailsByIds(
    userIds: string[],
  ): Promise<ManagedUserContactDetails[]> {
    if (userIds.length === 0) {
      return [];
    }

    return this.prisma.user.findMany({
      where: { userId: { in: userIds } },
      select: {
        userId: true,
        fullname: true,
        email: true,
        phone: true,
      },
    });
  }

  /**
   * Active customer gender counts for customers with activity at the tenant.
   * Catalog genders are always present (zero-filled).
   * Users with no genderId land in Unspecified.
   */
  async getCustomerGenderDistribution(
    tenantId: string,
  ): Promise<CustomerDemographicDistribution> {
    const where = this.customerInsightsWhere(tenantId);
    const [total, groups, genders] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.groupBy({
        by: ['genderId'],
        where,
        _count: { _all: true },
      }),
      this.prisma.gender.findMany({
        select: { genderId: true, gender: true },
        orderBy: { gender: 'asc' },
      }),
    ]);

    const countById = new Map(
      groups.map((group) => [group.genderId, group._count._all]),
    );

    const buckets: CustomerDemographicCount[] = genders.map((gender) => ({
      id: gender.genderId,
      label: gender.gender,
      count: countById.get(gender.genderId) ?? 0,
    }));

    buckets.push({
      id: null,
      label: UNSPECIFIED_DEMOGRAPHIC_LABEL,
      count: countById.get(null) ?? 0,
    });

    return { total, buckets };
  }

  /**
   * Active customer district density for the tenant, highest first.
   * Includes Unspecified.
   */
  async getCustomerDistrictDistribution(
    tenantId: string,
    topLimit: number,
  ): Promise<CustomerDemographicDistribution> {
    const where = this.customerInsightsWhere(tenantId);
    const [total, groups, districts] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.groupBy({
        by: ['districtId'],
        where,
        _count: { _all: true },
      }),
      this.prisma.district.findMany({
        select: { id: true, districtName: true },
      }),
    ]);

    const nameById = new Map(
      districts.map((district) => [district.id, district.districtName]),
    );

    const buckets = groups
      .map((group) => ({
        id: group.districtId,
        label:
          group.districtId == null
            ? UNSPECIFIED_DEMOGRAPHIC_LABEL
            : (nameById.get(group.districtId) ?? UNSPECIFIED_DEMOGRAPHIC_LABEL),
        count: group._count._all,
      }))
      .sort((left, right) => right.count - left.count)
      .slice(0, topLimit);

    return { total, buckets };
  }

  async getDemographicDistribution(
    tenantId: string,
    topDistrictLimit = 10,
  ): Promise<{
    gender: CustomerDemographicDistribution;
    districts: CustomerDemographicDistribution;
  }> {
    const [gender, districts] = await Promise.all([
      this.getCustomerGenderDistribution(tenantId),
      this.getCustomerDistrictDistribution(tenantId, topDistrictLimit),
    ]);

    return { gender, districts };
  }

  /**
   * Customers with loans or CustomerLoanActivity at this tenant.
   */
  private customerInsightsWhere(tenantId: string): Prisma.UserWhereInput {
    return {
      deletedAt: null,
      userRoles: {
        some: {
          role: { key: CUSTOMER_ROLE_KEY },
        },
      },
      OR: [
        { loansTaken: { some: { tenantId } } },
        { customerLoanActivities: { some: { tenantId } } },
      ],
    };
  }
}
