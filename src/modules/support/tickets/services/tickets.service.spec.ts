import {
  Prisma,
  SupportTicketPriority,
  SupportTicketStatus,
} from '@prisma/client';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { TicketsService } from './tickets.service';

describe('TicketsService.findAll', () => {
  const findMany = jest.fn(
    async (_args: Prisma.SupportTicketFindManyArgs) => [],
  );

  const prisma = {
    supportTicket: { findMany },
  };

  const service = new TicketsService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  beforeEach(() => {
    findMany.mockClear();
    findMany.mockImplementation(async () => []);
  });

  function lastWhere(): Prisma.SupportTicketWhereInput | undefined {
    expect(findMany).toHaveBeenCalledTimes(1);
    const [args] = findMany.mock.calls[0] ?? [];
    return args?.where;
  }

  it('omits status → active queue OPEN + IN_PROGRESS only (platform scope)', async () => {
    await service.findAll({ tenantId: null }, {});

    expect(lastWhere()).toEqual({
      tenantId: null,
      status: {
        in: [SupportTicketStatus.OPEN, SupportTicketStatus.IN_PROGRESS],
      },
    });
  });

  it('scopes tenant queue by tenantId', async () => {
    await service.findAll({ tenantId: 'tenant-a' }, {});

    expect(lastWhere()).toEqual({
      tenantId: 'tenant-a',
      status: {
        in: [SupportTicketStatus.OPEN, SupportTicketStatus.IN_PROGRESS],
      },
    });
  });

  it('status=OPEN → OPEN only', async () => {
    await service.findAll(
      { tenantId: null },
      { status: SupportTicketStatus.OPEN },
    );

    expect(lastWhere()).toEqual({
      tenantId: null,
      status: SupportTicketStatus.OPEN,
    });
  });

  it('status=IN_PROGRESS → IN_PROGRESS only', async () => {
    await service.findAll(
      { tenantId: null },
      { status: SupportTicketStatus.IN_PROGRESS },
    );

    expect(lastWhere()).toEqual({
      tenantId: null,
      status: SupportTicketStatus.IN_PROGRESS,
    });
  });

  it('status=RESOLVED → RESOLVED only', async () => {
    await service.findAll(
      { tenantId: null },
      { status: SupportTicketStatus.RESOLVED },
    );

    expect(lastWhere()).toEqual({
      tenantId: null,
      status: SupportTicketStatus.RESOLVED,
    });
  });

  it('status=HELD → HELD only', async () => {
    await service.findAll(
      { tenantId: null },
      { status: SupportTicketStatus.HELD },
    );

    expect(lastWhere()).toEqual({
      tenantId: null,
      status: SupportTicketStatus.HELD,
    });
  });

  it('other filters AND with the active default', async () => {
    await service.findAll(
      { tenantId: 'tenant-a' },
      {
        priority: SupportTicketPriority.HIGH,
        categoryId: 3,
        unassigned: true,
        hasUnreadCustomerReply: true,
      },
    );

    expect(lastWhere()).toEqual({
      tenantId: 'tenant-a',
      status: {
        in: [SupportTicketStatus.OPEN, SupportTicketStatus.IN_PROGRESS],
      },
      priority: SupportTicketPriority.HIGH,
      categoryId: 3,
      handlerId: null,
      hasUnreadCustomerReply: true,
    });
  });
});
