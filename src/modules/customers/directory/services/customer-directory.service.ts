import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../core/database/prisma.service';
import { CUSTOMER_ROLE_KEY } from '../../../auth/shared/constants/roles.constant';
import { ListCustomersQueryDto } from '../dto/list-customers-query.dto';

const CUSTOMER_LIST_SELECT = {
  userId: true,
  fullname: true,
  email: true,
  phone: true,
  isBlocked: true,
  avatarUrl: true,
} as const;

export interface CustomerListItem {
  userId: string;
  fullname: string;
  email: string | null;
  phone: string | null;
  isBlocked: boolean;
  avatarUrl: string | null;
}

export interface PaginatedCustomersResponse {
  data: CustomerListItem[];
  pagination: {
    page: number;
    hasNextPage: boolean;
  };
}

/**
 * Operational customer directory for tenant/platform staff
 * (special offers, loan issue, activity lookup).
 * Customers are platform users (tenantId null) with the Customer role.
 */
@Injectable()
export class CustomerDirectoryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: ListCustomersQueryDto,
  ): Promise<PaginatedCustomersResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      tenantId: null,
      userRoles: {
        some: {
          role: { key: CUSTOMER_ROLE_KEY },
        },
      },
    };

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { userId: { contains: search, mode: 'insensitive' } },
        { fullname: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const rows = await this.prisma.user.findMany({
      where,
      select: CUSTOMER_LIST_SELECT,
      orderBy: { fullname: 'asc' },
      skip,
      take: limit + 1,
    });

    const hasNextPage = rows.length > limit;
    const data = hasNextPage ? rows.slice(0, limit) : rows;

    return {
      data: data.map((row) => ({
        userId: row.userId,
        fullname: row.fullname,
        email: row.email,
        phone: row.phone,
        isBlocked: row.isBlocked ?? false,
        avatarUrl: row.avatarUrl,
      })),
      pagination: {
        page,
        hasNextPage,
      },
    };
  }
}
