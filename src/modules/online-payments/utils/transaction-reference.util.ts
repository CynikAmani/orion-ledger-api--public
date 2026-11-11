import { randomUUID } from 'crypto';

export function createTransactionReference(): string {
  return `ol_${randomUUID()}`;
}
