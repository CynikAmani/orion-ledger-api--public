import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { LOAN_AUDIT_ACTIONS } from '../../records/constants/loan-audit-actions.constant';
import { LOAN_STATUSES } from '../../records/constants/loan-status.constant';
import { REPAYMENT_AUDIT_ACTIONS } from '../constants/repayment-audit-actions.constant';
import { RepaymentsService } from './repayments.service';

describe('RepaymentsService loan-related audit', () => {
  const emitRelated = jest.fn<(...args: unknown[]) => void>();
  const findOne = jest.fn<(...args: unknown[]) => Promise<unknown>>();
  const markCleared = jest.fn<(...args: unknown[]) => Promise<unknown>>();
  const push = jest.fn();
  const dispatch = jest.fn();

  const loan = {
    loanId: 'internal-1',
    publicId: 'loan-pub-1',
    tenantId: 'tenant-1',
    customerId: 1,
    status: LOAN_STATUSES.ACTIVE,
    isCleared: false,
    returnAmount: 1000,
    loanAmount: 800,
  };

  const prisma = {
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        loan: {
          findFirst: jest.fn(async () => loan),
        },
        repayment: {
          aggregate: jest.fn(async () => ({ _sum: { amountPaid: 200 } })),
          create: jest.fn(async () => ({})),
        },
      }),
    ),
  };

  let service: RepaymentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    findOne.mockResolvedValue({
      customer: { fullname: 'Ada', email: null },
      customerId: 1,
      loanType: { typeName: 'Standard' },
      loanAmount: 800,
      returnAmount: 1000,
      amountPaid: 500,
      endDate: new Date('2026-08-01'),
    });

    service = new RepaymentsService(
      prisma as never,
      { emitRelated } as never,
      { push } as never,
      { dispatch } as never,
      {} as never,
      { resolveDisplayName: jest.fn(async () => 'Acme Credit') } as never,
      { findOne, markCleared } as never,
    );
  });

  it('writes a Repayment row and a related Loan row for the same actor', async () => {
    await service.record('tenant-1', 'loan-pub-1', 99, 300, {
      userId: 99,
      userEmail: 'staff@test.com',
    });

    expect(emitRelated).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 99,
        tenantId: 'tenant-1',
        module: 'REPAYMENTS',
        targetType: 'Repayment',
        action: REPAYMENT_AUDIT_ACTIONS.RECORDED,
        payload: expect.objectContaining({
          loanId: 'loan-pub-1',
          amount: 300,
          newBalance: 500,
          cleared: false,
          handlerId: 99,
        }),
      }),
      {
        module: 'LOANS',
        action: LOAN_AUDIT_ACTIONS.REPAYMENT_RECORDED,
        targetType: 'Loan',
        targetId: 'loan-pub-1',
        payload: {
          amount: 300,
          newBalance: 500,
          cleared: false,
          handlerId: 99,
        },
      },
    );
  });
});
