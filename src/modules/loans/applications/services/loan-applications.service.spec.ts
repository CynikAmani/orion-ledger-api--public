import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { LOAN_AUDIT_ACTIONS } from '../../records/constants/loan-audit-actions.constant';
import { LOAN_APPLICATION_AUDIT_ACTIONS } from '../constants/loan-application-audit-actions.constant';
import { LoanApplicationsService } from './loan-applications.service';

describe('LoanApplicationsService approval audit', () => {
  const emitRelated = jest.fn<(...args: unknown[]) => void>();
  const createFromApprovedApplication =
    jest.fn<(...args: unknown[]) => Promise<unknown>>();
  const assertLoanProvisionEligibility =
    jest.fn<(...args: unknown[]) => Promise<unknown>>();
  const recordApplicationApproved =
    jest.fn<(...args: unknown[]) => Promise<unknown>>();
  const findUniqueApplication = jest.fn<(args?: unknown) => Promise<unknown>>();
  const findUniqueLoanType = jest.fn<(args?: unknown) => Promise<unknown>>();
  const push = jest.fn();
  const dispatch = jest.fn();

  const application = {
    id: 42,
    tenantId: 'tenant-1',
    applicantId: 1,
    loanAmount: 5000,
    collateral: 'vehicle',
    collateralImageUrl: null,
    numWeeks: 8,
    location: 'Lilongwe',
    dateApplied: new Date('2026-01-01'),
    discount: 0,
    specialOfferId: null,
    specialOffer: null,
    isReviewed: true,
    loanTypeId: 1,
    activeRate: 10,
    interestRate: 10,
    expectedReturnAmount: 5500,
    users: { userId: 'customer-1', fullname: 'Ada', email: null },
    tenant: {
      tenantId: 'tenant-1',
      name: 'Acme',
      logoUrl: null,
      brandColor: null,
      brandProfile: null,
    },
  };

  const prisma = {
    loanApplication: { findUnique: findUniqueApplication },
    loanType: { findUnique: findUniqueLoanType },
    user: { findFirst: jest.fn(async () => ({ userId: 'staff-1' })) },
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        loanApplication: { delete: jest.fn(async () => ({})) },
      }),
    ),
  };

  let service: LoanApplicationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    findUniqueApplication.mockResolvedValue(application);
    findUniqueLoanType.mockResolvedValue({ tenantId: 'tenant-1' });
    createFromApprovedApplication.mockResolvedValue({
      loanId: 'internal-1',
      publicId: 'loan-pub-1',
    });
    assertLoanProvisionEligibility.mockResolvedValue(undefined);
    recordApplicationApproved.mockResolvedValue(undefined);

    service = new LoanApplicationsService(
      prisma as never,
      { emitRelated } as never,
      {} as never,
      {} as never,
      { push } as never,
      { dispatch } as never,
      {} as never,
      {} as never,
      {} as never,
      { createFromApprovedApplication } as never,
      { recordApplicationApproved } as never,
      {} as never,
      { assertLoanProvisionEligibility } as never,
      {} as never,
      {} as never,
      {} as never,
    );
  });

  it('writes who approved on both the application and the created loan', async () => {
    await service.approve('tenant-1', 42, 99, {
      userId: 99,
      userEmail: 'staff@test.com',
    });

    expect(emitRelated).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 99,
        userEmail: 'staff@test.com',
        tenantId: 'tenant-1',
        module: 'LOAN_APPLICATIONS',
        targetType: 'LoanApplication',
        action: LOAN_APPLICATION_AUDIT_ACTIONS.APPROVED,
        targetId: '42',
        payload: expect.objectContaining({
          loanId: 'loan-pub-1',
          handlerId: 99,
          applicantId: 1,
        }),
      }),
      {
        module: 'LOANS',
        action: LOAN_AUDIT_ACTIONS.APPROVED,
        targetType: 'Loan',
        targetId: 'loan-pub-1',
        payload: {
          applicationId: 42,
          applicantId: 1,
          handlerId: 99,
          loanAmount: 5000,
          returnAmount: 5500,
          interestRate: 10,
          origin: 'approval',
        },
      },
    );
  });
});
