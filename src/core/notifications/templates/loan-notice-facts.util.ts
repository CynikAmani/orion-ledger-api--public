import {
  formatCurrency,
  formatDurationWeeks,
  formatPaidPercent,
} from '../../../common/utils/format-currency.util';
import {
  formatDisplayDate,
  formatDisplayDateTime,
} from '../../../common/utils/format-date.util';

/**
 * Display strings for staff loan emails. Callers pass raw figures; this
 * formats them so the staff template can render rows without further lookup.
 */
export function loanNoticeFacts(input: {
  organization: string;
  customerName?: string | null;
  loanTypeName?: string | null;
  loanAmount?: number | null;
  returnAmount?: number | null;
  interestRate?: number | null;
  numWeeks?: number | null;
  startDate?: Date | null;
  dueDate?: Date | null;
  collateral?: string | null;
  repaidAmount?: number | null;
  amountPaidToDate?: number | null;
  remainingBalance?: number | null;
  location?: string | null;
  submittedAt?: Date | null;
  cleared?: boolean;
}): Record<string, string | boolean> {
  const facts: Record<string, string | boolean> = {
    organization: input.organization,
  };

  assign(facts, 'customerName', input.customerName);
  assign(facts, 'loanTypeName', input.loanTypeName);
  assignMoney(facts, 'loanAmount', input.loanAmount);
  assignMoney(facts, 'returnAmount', input.returnAmount);
  if (input.interestRate != null) {
    facts.interestRate = `${input.interestRate}%`;
  }
  if (input.numWeeks != null) {
    facts.duration = formatDurationWeeks(input.numWeeks);
  }
  if (input.startDate) {
    facts.startDate = formatDisplayDate(input.startDate);
  }
  if (input.dueDate) {
    facts.dueDate = formatDisplayDate(input.dueDate);
  }
  assign(facts, 'collateral', input.collateral);
  assignMoney(facts, 'repaidAmount', input.repaidAmount);
  assignMoney(facts, 'amountPaidToDate', input.amountPaidToDate);
  assignMoney(facts, 'remainingBalance', input.remainingBalance);
  if (input.amountPaidToDate != null && input.returnAmount != null) {
    facts.percentPaid = formatPaidPercent(
      input.amountPaidToDate,
      input.returnAmount,
    );
  }
  assign(facts, 'location', input.location);
  if (input.submittedAt) {
    facts.submittedAt = formatDisplayDateTime(input.submittedAt);
  }
  if (input.cleared != null) {
    facts.cleared = input.cleared;
  }

  return facts;
}

function assign(
  facts: Record<string, string | boolean>,
  key: string,
  value: string | null | undefined,
): void {
  const trimmed = value?.trim();
  if (trimmed) {
    facts[key] = trimmed;
  }
}

function assignMoney(
  facts: Record<string, string | boolean>,
  key: string,
  value: number | null | undefined,
): void {
  if (value != null) {
    facts[key] = formatCurrency(value);
  }
}
