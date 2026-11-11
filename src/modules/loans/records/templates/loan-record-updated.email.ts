import { formatCurrency } from '../../../../common/utils/format-currency.util';
import {
  buildBulletList,
  buildDetailRows,
  buildEmailDocument,
  buildParagraph,
  escapeHtml,
  finishEmailText,
} from '../../../../core/email/templates/email-template.util';

export interface LoanUpdateSnapshot {
  loanTypeName: string;
  loanAmount: number;
  returnAmount: number;
  interestRate: number;
  collateral: string;
  collateralImageUrl: string | null;
}

export function buildLoanUpdateChangeLines(params: {
  before: LoanUpdateSnapshot;
  after: LoanUpdateSnapshot;
  balance: number;
}): string[] {
  const { before, after, balance } = params;
  const lines: string[] = [];

  if (before.loanTypeName !== after.loanTypeName) {
    lines.push(`Loan product: ${before.loanTypeName} to ${after.loanTypeName}`);
  }

  if (before.loanAmount !== after.loanAmount) {
    lines.push(
      `Amount issued: ${formatCurrency(before.loanAmount)} to ${formatCurrency(after.loanAmount)}`,
    );
  }

  if (before.interestRate !== after.interestRate) {
    lines.push(
      `Interest rate: ${before.interestRate}% to ${after.interestRate}%`,
    );
  }

  if (before.returnAmount !== after.returnAmount) {
    lines.push(
      `Amount to repay: ${formatCurrency(before.returnAmount)} to ${formatCurrency(after.returnAmount)}`,
    );
  }

  if (before.collateral !== after.collateral) {
    lines.push(`Collateral: ${after.collateral}`);
  }

  if (before.collateralImageUrl !== after.collateralImageUrl) {
    lines.push('Collateral photo was updated.');
  }

  if (
    before.returnAmount !== after.returnAmount ||
    before.loanAmount !== after.loanAmount
  ) {
    lines.push(`Remaining balance: ${formatCurrency(balance)}`);
  }

  return lines;
}

export function buildLoanRecordUpdatedEmail(params: {
  fullname: string;
  brandName: string;
  changes: string[];
  remainingBalance?: number;
  loanTypeName?: string;
}): { subject: string; html: string; text: string } {
  const subject = 'Your loan details have been updated';

  const html = buildEmailDocument({
    subject,
    eyebrow: 'Loan update',
    eyebrowColor: '#b45309',
    icon: 'neutral',
    heading: 'We updated your loan',
    bodyHtml: [
      buildParagraph(
        `Dear ${escapeHtml(params.fullname)}, ${escapeHtml(params.brandName)} updated the details of your loan. The changes are listed below.`,
      ),
      buildDetailRows([
        { label: 'Organization', value: params.brandName },
        ...(params.loanTypeName
          ? [{ label: 'Loan product', value: params.loanTypeName }]
          : []),
        ...(params.remainingBalance != null
          ? [
              {
                label: 'Remaining balance',
                value: formatCurrency(params.remainingBalance),
              },
            ]
          : []),
      ]),
      params.changes.length > 0 ? buildBulletList(params.changes) : '',
      buildParagraph(
        'If any of these figures look unexpected, contact the organization.',
      ),
    ].join(''),
  });

  const text = finishEmailText([
    `Dear ${params.fullname},`,
    '',
    `${params.brandName} updated the details of your loan. The changes are listed below.`,
    '',
    `Organization: ${params.brandName}`,
    ...(params.loanTypeName ? [`Loan product: ${params.loanTypeName}`] : []),
    ...(params.remainingBalance != null
      ? [`Remaining balance: ${formatCurrency(params.remainingBalance)}`]
      : []),
    ...params.changes.map((line) => `- ${line}`),
    '',
    'If any of these figures look unexpected, contact the organization.',
  ]);

  return { subject, html, text };
}
