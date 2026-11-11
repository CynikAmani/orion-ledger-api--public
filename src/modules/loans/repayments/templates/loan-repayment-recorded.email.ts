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

export function buildLoanRepaymentRecordedEmail(params: {
  fullname: string;
  brandName: string;
  repaidAmount: number;
  remainingBalance: number;
  amountPaidToDate: number;
  returnAmount: number;
  dueDate: Date;
  loanTypeName?: string;
  cleared: boolean;
}): { subject: string; html: string; text: string } {
  const percentPaid = formatPaidPercent(
    params.amountPaidToDate,
    params.returnAmount,
  );
  const subject = params.cleared
    ? 'Your loan has been fully repaid'
    : 'We recorded your loan repayment';

  const html = buildEmailDocument({
    subject,
    eyebrow: params.cleared ? 'Loan cleared' : 'Repayment',
    icon: 'success',
    heading: params.cleared
      ? 'This loan is fully repaid'
      : 'Repayment received',
    bodyHtml: [
      buildParagraph(
        params.cleared
          ? `Dear ${escapeHtml(params.fullname)}, ${escapeHtml(params.brandName)} has recorded your payment of ${escapeHtml(formatCurrency(params.repaidAmount))}. This loan is now fully repaid. No further instalments are due on it.`
          : `Dear ${escapeHtml(params.fullname)}, ${escapeHtml(params.brandName)} has recorded your payment of ${escapeHtml(formatCurrency(params.repaidAmount))}. Your remaining balance is shown below.`,
      ),
      buildDetailRows([
        { label: 'Organization', value: params.brandName },
        ...(params.loanTypeName
          ? [{ label: 'Loan product', value: params.loanTypeName }]
          : []),
        {
          label: 'Amount received',
          value: formatCurrency(params.repaidAmount),
        },
        {
          label: 'Paid to date',
          value: formatCurrency(params.amountPaidToDate),
        },
        {
          label: 'Remaining balance',
          value: formatCurrency(params.remainingBalance),
        },
        { label: 'Share paid', value: percentPaid },
        {
          label: 'Total to repay',
          value: formatCurrency(params.returnAmount),
        },
        { label: 'Due date', value: formatDisplayDate(params.dueDate) },
      ]),
      buildParagraph(
        params.cleared
          ? 'Keep this email for your records.'
          : 'Please continue payments until the remaining balance is cleared, and no later than the due date.',
      ),
    ].join(''),
  });

  const text = finishEmailText([
    `Dear ${params.fullname},`,
    '',
    params.cleared
      ? `${params.brandName} has recorded your payment of ${formatCurrency(params.repaidAmount)}. This loan is now fully repaid.`
      : `${params.brandName} has recorded your payment of ${formatCurrency(params.repaidAmount)}.`,
    '',
    `Organization: ${params.brandName}`,
    ...(params.loanTypeName ? [`Loan product: ${params.loanTypeName}`] : []),
    `Amount received: ${formatCurrency(params.repaidAmount)}`,
    `Paid to date: ${formatCurrency(params.amountPaidToDate)}`,
    `Remaining balance: ${formatCurrency(params.remainingBalance)}`,
    `Share paid: ${percentPaid}`,
    `Total to repay: ${formatCurrency(params.returnAmount)}`,
    `Due date: ${formatDisplayDate(params.dueDate)}`,
    '',
    params.cleared
      ? 'No further instalments are due on this loan.'
      : 'Please continue payments until the remaining balance is cleared, and no later than the due date.',
  ]);

  return { subject, html, text };
}
