import { Prisma } from '@prisma/client';

export type PlanDiscountKind = 'PERCENTAGE' | 'FIXED_AMOUNT';

export type PlanDiscountScheduleStatus = 'UPCOMING' | 'ACTIVE' | 'EXPIRED';

export interface DiscountScheduleWindow {
  id: number;
  code?: string | null;
  discountType: PlanDiscountKind;
  value: number;
  startsAt: Date;
  endsAt: Date;
  isActive: boolean;
}

export function planDiscountScheduleStatus(
  now: Date,
  window: { startsAt: Date; endsAt: Date },
): PlanDiscountScheduleStatus {
  if (window.startsAt > now) {
    return 'UPCOMING';
  }

  if (window.endsAt < now) {
    return 'EXPIRED';
  }

  return 'ACTIVE';
}

export function discountWindowsOverlap(
  left: { startsAt: Date; endsAt: Date },
  right: { startsAt: Date; endsAt: Date },
): boolean {
  return left.startsAt < right.endsAt && left.endsAt > right.startsAt;
}

export function normalizeDiscountCode(code: string): string {
  return code.trim().toLowerCase();
}

/** Public schedule only. A discount with a code is redeemed at checkout. */
export function findPublicPlanDiscount<T extends DiscountScheduleWindow>(
  now: Date,
  discounts: T[],
): T | null {
  return findActivePlanDiscount(
    now,
    discounts.filter((discount) => !discount.code),
  );
}

/**
 * No code, a blank code, or null uses the public schedule.
 * A non-blank code must match a live coupon. It does not fall back to the public price.
 */
export function resolveCheckoutDiscount<T extends DiscountScheduleWindow>(
  now: Date,
  discounts: T[],
  discountCode?: string | null,
): { discount: T | null; codeRejected: boolean } {
  const submitted = discountCode?.trim() ?? '';
  if (!submitted) {
    return {
      discount: findPublicPlanDiscount(now, discounts),
      codeRejected: false,
    };
  }

  const redeemed = findRedeemablePlanDiscount(now, discounts, submitted);
  if (!redeemed) {
    return { discount: null, codeRejected: true };
  }

  return { discount: redeemed, codeRejected: false };
}

export function findRedeemablePlanDiscount<T extends DiscountScheduleWindow>(
  now: Date,
  discounts: T[],
  code: string,
): T | null {
  const normalized = normalizeDiscountCode(code);
  if (!normalized) {
    return null;
  }

  return findActivePlanDiscount(
    now,
    discounts.filter(
      (discount) =>
        !!discount.code && normalizeDiscountCode(discount.code) === normalized,
    ),
  );
}

/**
 * The discount that changes the price now.
 * A later start wins if more than one active window matches.
 */
export function findActivePlanDiscount<T extends DiscountScheduleWindow>(
  now: Date,
  discounts: T[],
): T | null {
  const matches = discounts.filter(
    (discount) =>
      discount.isActive && discount.startsAt <= now && now <= discount.endsAt,
  );

  if (matches.length === 0) {
    return null;
  }

  return matches.reduce((current, discount) => {
    if (discount.startsAt > current.startsAt) {
      return discount;
    }

    if (
      discount.startsAt.getTime() === current.startsAt.getTime() &&
      discount.id < current.id
    ) {
      return discount;
    }

    return current;
  });
}

export function discountValueError(input: {
  discountType: PlanDiscountKind;
  value: number;
  price: Prisma.Decimal;
}): string | null {
  if (!Number.isInteger(input.value) || input.value < 1) {
    return 'Discount value must be a positive whole number';
  }

  if (
    input.discountType === 'PERCENTAGE' &&
    (input.value < 1 || input.value > 100)
  ) {
    return 'Percentage discounts must be between 1 and 100';
  }

  if (
    input.discountType === 'FIXED_AMOUNT' &&
    new Prisma.Decimal(input.value).greaterThan(input.price)
  ) {
    return 'Fixed discount cannot exceed the plan price';
  }

  return null;
}

export function calculateDiscountedPrice(
  price: Prisma.Decimal,
  discount: { discountType: PlanDiscountKind; value: number } | null,
): Prisma.Decimal {
  const base = price.toDecimalPlaces(2);
  if (!discount) {
    return base;
  }

  if (discount.discountType === 'PERCENTAGE') {
    const reduction = base.mul(discount.value).div(100);
    return base.minus(reduction).toDecimalPlaces(2);
  }

  const reduced = base.minus(discount.value);
  if (reduced.lessThan(0)) {
    return new Prisma.Decimal(0).toDecimalPlaces(2);
  }

  return reduced.toDecimalPlaces(2);
}
