import { formatCurrency } from '../../../../common/utils/format-currency.util';
import { formatDisplayDate } from '../../../../common/utils/format-date.util';
import {
  buildDetailRows,
  buildEmailDocument,
  buildParagraph,
  escapeHtml,
  finishEmailText,
} from '../../../../core/email/templates/email-template.util';

export function buildLoanDefaultedEmail(params: {
  fullname: string;
  brandName: string;
  remainingBalance: number;
  loanAmount: number;
  returnAmount: number;
  dueDate: Date;
  loanTypeName?: string;
}): { subject: string; html: string; text: string } {
  const subject = 'Your loan has been marked as defaulted';

  const html = buildEmailDocument({
    subject,
    eyebrow: 'Account notice',
    eyebrowColor: '#b45309',
    icon: 'warning',
    heading: 'Loan marked as defaulted',
    bodyHtml: [
      buildParagraph(
        `Dear ${escapeHtml(params.fullname)}, ${escapeHtml(params.brandName)} has marked your loan as defaulted because the outstanding balance was not cleared. Your account is blocked from new loan activity until this is resolved.`,
      ),
      buildDetailRows([
        { label: 'Organization', value: params.brandName },
        ...(params.loanTypeName
          ? [{ label: 'Loan product', value: params.loanTypeName }]
          : []),
        {
          label: 'Outstanding balance',
          value: formatCurrency(params.remainingBalance),
        },
        { label: 'Amount issued', value: formatCurrency(params.loanAmount) },
        {
          label: 'Total that was due',
          value: formatCurrency(params.returnAmount),
        },
        {
          label: 'Original due date',
          value: formatDisplayDate(params.dueDate),
        },
      ]),
      buildParagraph(
        `Please contact ${escapeHtml(params.brandName)} promptly to discuss settlement.`,
      ),
    ].join(''),
  });

  const text = finishEmailText([
    `Dear ${params.fullname},`,
    '',
    `${params.brandName} has marked your loan as defaulted because the outstanding balance was not cleared. Your account is blocked from new loan activity until this is resolved.`,
    '',
    `Organization: ${params.brandName}`,
    ...(params.loanTypeName ? [`Loan product: ${params.loanTypeName}`] : []),
    `Outstanding balance: ${formatCurrency(params.remainingBalance)}`,
    `Amount issued: ${formatCurrency(params.loanAmount)}`,
    `Total that was due: ${formatCurrency(params.returnAmount)}`,
    `Original due date: ${formatDisplayDate(params.dueDate)}`,
    '',
    `Please contact ${params.brandName} promptly to discuss settlement.`,
  ]);

  return { subject, html, text };
}
