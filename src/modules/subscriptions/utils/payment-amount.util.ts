import { Prisma } from '@prisma/client';

export function formatPaymentAmount(amount: Prisma.Decimal): string {
  return amount.toDecimalPlaces(2).toFixed(2);
}

export function paymentAmountsMatch(
  stored: Prisma.Decimal,
  verified: number,
): boolean {
  if (!Number.isFinite(verified)) {
    return false;
  }

  const verifiedAmount = new Prisma.Decimal(verified).toDecimalPlaces(2);
  return stored.toDecimalPlaces(2).equals(verifiedAmount);
}
