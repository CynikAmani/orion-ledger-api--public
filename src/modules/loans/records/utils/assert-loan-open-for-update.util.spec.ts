import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from '@jest/globals';
import { LOAN_STATUSES } from '../constants/loan-status.constant';
import {
  assertLoanOpenForStaffUpdate,
  assertUpdatedReturnExceedsAmountPaid,
  isLoanOpenForStaffUpdate,
} from './assert-loan-open-for-update.util';

describe('assertLoanOpenForStaffUpdate', () => {
  it('allows active and overdue loans', () => {
    expect(
      isLoanOpenForStaffUpdate({ status: LOAN_STATUSES.ACTIVE }),
    ).toBe(true);
    expect(
      isLoanOpenForStaffUpdate({ status: LOAN_STATUSES.OVERDUE }),
    ).toBe(true);
  });

  it('rejects cleared, defaulted, and legacy isCleared rows', () => {
    expect(
      isLoanOpenForStaffUpdate({ status: LOAN_STATUSES.CLEARED }),
    ).toBe(false);
    expect(
      isLoanOpenForStaffUpdate({ status: LOAN_STATUSES.DEFAULTED }),
    ).toBe(false);
    expect(
      isLoanOpenForStaffUpdate({
        status: LOAN_STATUSES.ACTIVE,
        isCleared: true,
      }),
    ).toBe(false);
  });

  it('throws a stable message when the loan is not editable', () => {
    expect(() =>
      assertLoanOpenForStaffUpdate({ status: LOAN_STATUSES.DEFAULTED }),
    ).toThrow(BadRequestException);
  });
});

describe('assertUpdatedReturnExceedsAmountPaid', () => {
  it('allows any return when nothing has been paid', () => {
    expect(() =>
      assertUpdatedReturnExceedsAmountPaid(50_000, 0),
    ).not.toThrow();
  });

  it('allows a return strictly above amount paid', () => {
    expect(() =>
      assertUpdatedReturnExceedsAmountPaid(110_000, 40_000),
    ).not.toThrow();
  });

  it('rejects shrinking the contract to or below amount paid', () => {
    expect(() =>
      assertUpdatedReturnExceedsAmountPaid(40_000, 40_000),
    ).toThrow(BadRequestException);
    expect(() =>
      assertUpdatedReturnExceedsAmountPaid(30_000, 40_000),
    ).toThrow(BadRequestException);
  });
});
