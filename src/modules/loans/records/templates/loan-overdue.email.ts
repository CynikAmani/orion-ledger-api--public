import {
  formatCurrency,
  formatPaidPercent,
} from '../../../../common/utils/format-currency.util';
import { formatDisplayDate } from '../../../../common/utils/format-date.util';
import {
  buildDetailRows,
  buildEmailDocument,
  buildParagraph,
  escapeHtml,
  finishEmailText,
} from '../../../../core/email/templates/email-template.util';

export function buildLoanOverdueEmail(params: {
  fullname: string;
  brandName: string;
  remainingBalance: number;
  amountPaidToDate: number;
  returnAmount: number;
  dueDate: Date;
  loanTypeName?: string;
}): { subject: string; html: string; text: string } {
  const subject = 'Your loan is past the due date';
  const percentPaid = formatPaidPercent(
    params.amountPaidToDate,
    params.returnAmount,
  );

  const html = buildEmailDocument({
    subject,
    eyebrow: 'Payment overdue',
    eyebrowColor: '#b45309',
    icon: 'warning',
    heading: 'This loan is overdue',
    bodyHtml: [
      buildParagraph(
        `Dear ${escapeHtml(params.fullname)}, the due date on your loan with ${escapeHtml(params.brandName)} has passed and a balance is still outstanding. New loan activity on your account is paused until this is resolved.`,
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
        {
          label: 'Paid to date',
          value: formatCurrency(params.amountPaidToDate),
        },
        { label: 'Share paid', value: percentPaid },
        {
          label: 'Total to repay',
          value: formatCurrency(params.returnAmount),
        },
        { label: 'Due date', value: formatDisplayDate(params.dueDate) },
      ]),
      buildParagraph(
        `Please arrange repayment of the outstanding balance with ${escapeHtml(params.brandName)} as soon as you can.`,
      ),
    ].join(''),
  });

  const text = finishEmailText([
    `Dear ${params.fullname},`,
    '',
    `The due date on your loan with ${params.brandName} has passed and a balance is still outstanding. New loan activity on your account is paused until this is resolved.`,
    '',
    `Organization: ${params.brandName}`,
    ...(params.loanTypeName ? [`Loan product: ${params.loanTypeName}`] : []),
    `Outstanding balance: ${formatCurrency(params.remainingBalance)}`,
    `Paid to date: ${formatCurrency(params.amountPaidToDate)}`,
    `Share paid: ${percentPaid}`,
    `Total to repay: ${formatCurrency(params.returnAmount)}`,
    `Due date: ${formatDisplayDate(params.dueDate)}`,
    '',
    `Please arrange repayment of the outstanding balance with ${params.brandName} as soon as you can.`,
  ]);

  return { subject, html, text };
}
