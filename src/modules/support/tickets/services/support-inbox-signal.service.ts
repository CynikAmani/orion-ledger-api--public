import { Injectable } from '@nestjs/common';
import { SupportTicketStatus } from '@prisma/client';
import { PrismaService } from '../../../../core/database/prisma.service';
import { PERMISSIONS } from '../../../auth/shared/constants/permissions.constant';

export const SUPPORT_INBOX_AUDIENCE = {
  PLATFORM: 'platform',
  TENANT: 'tenant',
  CUSTOMER: 'customer',
} as const;

export type SupportInboxAudience =
  (typeof SUPPORT_INBOX_AUDIENCE)[keyof typeof SUPPORT_INBOX_AUDIENCE];

export interface SupportInboxSignal {
  audience: SupportInboxAudience | null;
  newTicketCount: number;
  replyCount: number;
}

const EMPTY_SIGNAL: SupportInboxSignal = {
  audience: null,
  newTicketCount: 0,
  replyCount: 0,
};

const STAFF_FOLLOW_UP_STATUSES = [
  SupportTicketStatus.OPEN,
  SupportTicketStatus.IN_PROGRESS,
];

export function resolveSupportInboxAudience(input: {
  tenantId: string | null;
  permissions: readonly string[];
}): SupportInboxAudience | null {
  if (
    input.tenantId &&
    input.permissions.includes(PERMISSIONS.SUPPORT.TENANT_READ)
  ) {
    return SUPPORT_INBOX_AUDIENCE.TENANT;
  }

  if (input.permissions.includes(PERMISSIONS.SUPPORT.PLATFORM_READ)) {
    return SUPPORT_INBOX_AUDIENCE.PLATFORM;
  }

  if (input.permissions.includes(PERMISSIONS.SUPPORT.CUSTOMER_READ)) {
    return SUPPORT_INBOX_AUDIENCE.CUSTOMER;
  }

  return null;
}

@Injectable()
export class SupportInboxSignalService {
  constructor(private readonly prisma: PrismaService) {}

  async forLogin(input: {
    userId: number;
    tenantId: string | null;
    permissions: readonly string[];
  }): Promise<SupportInboxSignal> {
    const audience = resolveSupportInboxAudience(input);

    if (!audience) {
      return EMPTY_SIGNAL;
    }

    if (audience === SUPPORT_INBOX_AUDIENCE.CUSTOMER) {
      const replyCount = await this.prisma.supportTicket.count({
        where: {
          userId: input.userId,
          hasUnreadStaffReply: true,
        },
      });

      return {
        audience,
        newTicketCount: 0,
        replyCount,
      };
    }

    const tenantId =
      audience === SUPPORT_INBOX_AUDIENCE.PLATFORM ? null : input.tenantId;

    const [newTicketCount, replyCount] = await Promise.all([
      this.prisma.supportTicket.count({
        where: {
          tenantId,
          status: SupportTicketStatus.OPEN,
          handlerId: null,
          hasUnreadCustomerReply: true,
        },
      }),
      this.prisma.supportTicket.count({
        where: {
          tenantId,
          status: { in: STAFF_FOLLOW_UP_STATUSES },
          handlerId: { not: null },
          hasUnreadCustomerReply: true,
        },
      }),
    ]);

    return {
      audience,
      newTicketCount,
      replyCount,
    };
  }
}
