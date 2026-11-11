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

export function buildLoanApplicationApprovedEmail(params: {
  fullname: string;
  brandName: string;
  loanAmount: number;
  returnAmount: number;
  interestRate: number;
  numWeeks: number;
  startDate: Date;
  endDate: Date;
  loanTypeName?: string;
}): { subject: string; html: string; text: string } {
  const subject = 'Your loan application has been approved';
  const amountLabel = formatCurrency(params.loanAmount);
  const repayLabel = formatCurrency(params.returnAmount);

  const html = buildEmailDocument({
    subject,
    eyebrow: 'Loan application',
    icon: 'success',
    heading: 'Your application is approved',
    bodyHtml: [
      buildParagraph(
        `Dear ${escapeHtml(params.fullname)}, ${escapeHtml(params.brandName)} has approved your loan application. The loan is now active on your account.`,
      ),
      buildDetailRows([
        { label: 'Organization', value: params.brandName },
        ...(params.loanTypeName
          ? [{ label: 'Loan product', value: params.loanTypeName }]
          : []),
        { label: 'Amount issued', value: amountLabel },
        { label: 'Amount to repay', value: repayLabel },
        { label: 'Interest rate', value: `${params.interestRate}%` },
        { label: 'Duration', value: formatDurationWeeks(params.numWeeks) },
        { label: 'Start date', value: formatDisplayDate(params.startDate) },
        { label: 'Due date', value: formatDisplayDate(params.endDate) },
      ]),
      buildParagraph(
        'Please repay by the due date above. Your remaining balance updates as payments are recorded.',
      ),
    ].join(''),
  });

  const text = finishEmailText([
    `Dear ${params.fullname},`,
    '',
    `${params.brandName} has approved your loan application. The loan is now active on your account.`,
    '',
    `Organization: ${params.brandName}`,
    ...(params.loanTypeName ? [`Loan product: ${params.loanTypeName}`] : []),
    `Amount issued: ${amountLabel}`,
    `Amount to repay: ${repayLabel}`,
    `Interest rate: ${params.interestRate}%`,
    `Duration: ${formatDurationWeeks(params.numWeeks)}`,
    `Start date: ${formatDisplayDate(params.startDate)}`,
    `Due date: ${formatDisplayDate(params.endDate)}`,
    '',
    'Please repay by the due date above. Your remaining balance updates as payments are recorded.',
  ]);

  return { subject, html, text };
}
