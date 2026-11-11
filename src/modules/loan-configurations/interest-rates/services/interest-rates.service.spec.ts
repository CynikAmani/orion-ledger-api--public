import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { InterestRatesService } from './interest-rates.service';

describe('InterestRatesService.create', () => {
  const loanTypeFindMany = jest.fn<(args?: unknown) => Promise<unknown[]>>();
  const interestRateFindFirst = jest.fn<(args?: unknown) => Promise<unknown>>();
  const interestRateCreate = jest.fn<(args?: unknown) => Promise<unknown>>();
  const refresh = jest.fn<(args?: unknown) => Promise<unknown>>();
  const emit = jest.fn();

  const service = new InterestRatesService(
    {
      loanType: { findMany: loanTypeFindMany },
      interestRate: { findFirst: interestRateFindFirst },
      $transaction: async (run: (tx: unknown) => Promise<unknown>) =>
        run({ interestRate: { create: interestRateCreate } }),
    } as never,
    { emit } as never,
    { refresh } as never,
  );

  const audit = {
    actorId: 1,
    requestId: 'req-1',
  } as never;

  beforeEach(() => {
    jest.clearAllMocks();
    loanTypeFindMany.mockResolvedValue([{ loanTypeId: 4 }]);
    interestRateFindFirst.mockResolvedValue(null);
    interestRateCreate.mockImplementation(async (args) => {
      const data = (args as { data: { numWeeks: number } }).data;
      return {
        rateId: data.numWeeks,
        loanTypeId: 4,
        numWeeks: data.numWeeks,
        activeRate: 10,
        standardRate: 15,
      };
    });
  });

  it('stores every row in one save', async () => {
    const result = await service.create(
      'tenant-1',
      {
        rates: [
          { loanTypeId: 4, numWeeks: 4, activeRate: 10, standardRate: 15 },
          { loanTypeId: 4, numWeeks: 8, activeRate: 12, standardRate: 18 },
        ],
      },
      audit,
    );

    expect(result).toHaveLength(2);
    expect(interestRateCreate).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('rejects a repeated duration before writing any row', async () => {
    await expect(
      service.create(
        'tenant-1',
        {
          rates: [
            { loanTypeId: 4, numWeeks: 4, activeRate: 10, standardRate: 15 },
            { loanTypeId: 4, numWeeks: 4, activeRate: 11, standardRate: 16 },
          ],
        },
        audit,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(interestRateCreate).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('rejects a duration that is already saved', async () => {
    interestRateFindFirst.mockResolvedValue({ loanTypeId: 4, numWeeks: 8 });

    await expect(
      service.create(
        'tenant-1',
        {
          rates: [
            { loanTypeId: 4, numWeeks: 8, activeRate: 12, standardRate: 18 },
          ],
        },
        audit,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(interestRateCreate).not.toHaveBeenCalled();
  });
});
