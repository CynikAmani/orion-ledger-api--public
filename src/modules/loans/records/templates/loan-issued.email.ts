import {
  formatCurrency,
  formatDurationWeeks,
} from '../../../../common/utils/format-currency.util';
import { formatDisplayDate } from '../../../../common/utils/format-date.util';
import {
  buildDetailRows,
  buildEmailDocument,
  buildParagraph,
  escapeHtml,
  finishEmailText,
} from '../../../../core/email/templates/email-template.util';

export function buildLoanIssuedEmail(params: {
  fullname: string;
  brandName: string;
  loanAmount: number;
  returnAmount: number;
  interestRate: number;
  numWeeks: number;
  startDate: Date;
  endDate: Date;
  loanTypeName?: string;
  collateral?: string;
}): { subject: string; html: string; text: string } {
  const subject = 'A loan has been issued to your account';

  const html = buildEmailDocument({
    subject,
    eyebrow: 'Loan',
    icon: 'success',
    heading: 'Your loan is active',
    bodyHtml: [
      buildParagraph(
        `Dear ${escapeHtml(params.fullname)}, ${escapeHtml(params.brandName)} has issued a loan to your account. The figures below are the terms you are expected to follow.`,
      ),
      buildDetailRows([
        { label: 'Organization', value: params.brandName },
        ...(params.loanTypeName
          ? [{ label: 'Loan product', value: params.loanTypeName }]
          : []),
        { label: 'Amount issued', value: formatCurrency(params.loanAmount) },
        {
          label: 'Amount to repay',
          value: formatCurrency(params.returnAmount),
        },
        { label: 'Interest rate', value: `${params.interestRate}%` },
        { label: 'Duration', value: formatDurationWeeks(params.numWeeks) },
        { label: 'Start date', value: formatDisplayDate(params.startDate) },
        { label: 'Due date', value: formatDisplayDate(params.endDate) },
        ...(params.collateral
          ? [{ label: 'Collateral recorded', value: params.collateral }]
          : []),
      ]),
      buildParagraph(
        'Please complete repayment by the due date. Your remaining balance updates as payments are recorded.',
      ),
    ].join(''),
  });

  const text = finishEmailText([
    `Dear ${params.fullname},`,
    '',
    `${params.brandName} has issued a loan to your account. The figures below are the terms you are expected to follow.`,
    '',
    `Organization: ${params.brandName}`,
    ...(params.loanTypeName ? [`Loan product: ${params.loanTypeName}`] : []),
    `Amount issued: ${formatCurrency(params.loanAmount)}`,
    `Amount to repay: ${formatCurrency(params.returnAmount)}`,
    `Interest rate: ${params.interestRate}%`,
    `Duration: ${formatDurationWeeks(params.numWeeks)}`,
    `Start date: ${formatDisplayDate(params.startDate)}`,
    `Due date: ${formatDisplayDate(params.endDate)}`,
    ...(params.collateral ? [`Collateral recorded: ${params.collateral}`] : []),
    '',
    'Please complete repayment by the due date. Your remaining balance updates as payments are recorded.',
  ]);

  return { subject, html, text };
}
