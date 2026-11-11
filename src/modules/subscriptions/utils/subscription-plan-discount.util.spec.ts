import { Prisma } from '@prisma/client';
import { describe, expect, it } from '@jest/globals';
import {
  calculateDiscountedPrice,
  discountValueError,
  discountWindowsOverlap,
  findActivePlanDiscount,
  findPublicPlanDiscount,
  findRedeemablePlanDiscount,
  resolveCheckoutDiscount,
  planDiscountScheduleStatus,
  type DiscountScheduleWindow,
} from './subscription-plan-discount.util';

const price = new Prisma.Decimal('30000.00');

function window(
  overrides: Partial<DiscountScheduleWindow> &
    Pick<DiscountScheduleWindow, 'id'>,
): DiscountScheduleWindow {
  return {
    discountType: 'PERCENTAGE',
    value: 10,
    startsAt: new Date('2026-09-01T00:00:00.000Z'),
    endsAt: new Date('2026-10-01T00:00:00.000Z'),
    isActive: true,
    ...overrides,
  };
}

describe('plan discount schedule', () => {
  const now = new Date('2026-09-26T08:00:00.000Z');

  it('marks a future window upcoming and a finished window expired', () => {
    expect(
      planDiscountScheduleStatus(now, {
        startsAt: new Date('2026-10-01T00:00:00.000Z'),
        endsAt: new Date('2026-10-15T00:00:00.000Z'),
      }),
    ).toBe('UPCOMING');
    expect(
      planDiscountScheduleStatus(now, {
        startsAt: new Date('2026-08-01T00:00:00.000Z'),
        endsAt: new Date('2026-09-01T00:00:00.000Z'),
      }),
    ).toBe('EXPIRED');
  });

  it('keeps a window active through its end instant', () => {
    expect(
      planDiscountScheduleStatus(new Date('2026-10-01T00:00:00.000Z'), {
        startsAt: new Date('2026-09-01T00:00:00.000Z'),
        endsAt: new Date('2026-10-01T00:00:00.000Z'),
      }),
    ).toBe('ACTIVE');
  });

  it('ignores an inactive window that covers now', () => {
    expect(
      findActivePlanDiscount(now, [window({ id: 4, isActive: false })]),
    ).toBeNull();
  });

  it('keeps a coupon out of the public price', () => {
    expect(
      findPublicPlanDiscount(now, [window({ id: 4, code: 'PROMO10' })]),
    ).toBeNull();
  });

  it('redeems a code that is active and not expired', () => {
    const coupon = window({ id: 4, code: 'PROMO10' });
    expect(findRedeemablePlanDiscount(now, [coupon], ' promo10 ')?.id).toBe(4);
  });

  it('charges the public price when the customer sends no code', () => {
    const publicDiscount = window({ id: 2 });
    const coupon = window({ id: 4, code: 'PROMO10', value: 50 });

    expect(
      resolveCheckoutDiscount(now, [publicDiscount, coupon], undefined),
    ).toEqual({ discount: publicDiscount, codeRejected: false });
    expect(resolveCheckoutDiscount(now, [publicDiscount, coupon], '  ')).toEqual(
      { discount: publicDiscount, codeRejected: false },
    );
    expect(resolveCheckoutDiscount(now, [publicDiscount, coupon], null)).toEqual(
      { discount: publicDiscount, codeRejected: false },
    );
  });

  it('rejects an expired or unknown code', () => {
    const expired = window({
      id: 4,
      code: 'PROMO10',
      startsAt: new Date('2026-08-01T00:00:00.000Z'),
      endsAt: new Date('2026-09-01T00:00:00.000Z'),
    });
    expect(findRedeemablePlanDiscount(now, [expired], 'PROMO10')).toBeNull();
    expect(
      findRedeemablePlanDiscount(now, [window({ id: 5 })], 'PROMO10'),
    ).toBeNull();
  });

  it('treats windows that only touch at the boundary as separate', () => {
    expect(
      discountWindowsOverlap(
        {
          startsAt: new Date('2026-09-01T00:00:00.000Z'),
          endsAt: new Date('2026-10-01T00:00:00.000Z'),
        },
        {
          startsAt: new Date('2026-10-01T00:00:00.000Z'),
          endsAt: new Date('2026-10-15T00:00:00.000Z'),
        },
      ),
    ).toBe(false);
  });
});

describe('discounted plan price', () => {
  it('takes a percentage off the list price', () => {
    expect(
      calculateDiscountedPrice(price, {
        discountType: 'PERCENTAGE',
        value: 10,
      }).toFixed(2),
    ).toBe('27000.00');
  });

  it('takes a fixed amount off the list price and floors at zero', () => {
    expect(
      calculateDiscountedPrice(price, {
        discountType: 'FIXED_AMOUNT',
        value: 15000,
      }).toFixed(2),
    ).toBe('15000.00');
    expect(
      calculateDiscountedPrice(price, {
        discountType: 'FIXED_AMOUNT',
        value: 30000,
      }).toFixed(2),
    ).toBe('0.00');
  });

  it('rejects a percentage outside 1 to 100 and a fixed amount above the price', () => {
    expect(
      discountValueError({
        discountType: 'PERCENTAGE',
        value: 101,
        price,
      }),
    ).toBe('Percentage discounts must be between 1 and 100');
    expect(
      discountValueError({
        discountType: 'FIXED_AMOUNT',
        value: 30001,
        price,
      }),
    ).toBe('Fixed discount cannot exceed the plan price');
    expect(
      discountValueError({
        discountType: 'FIXED_AMOUNT',
        value: 30000,
        price,
      }),
    ).toBeNull();
  });
});
