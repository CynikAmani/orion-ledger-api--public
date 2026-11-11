import {
  formatCurrency,
  formatDurationWeeks,
} from '../../../../common/utils/format-currency.util';
import {
  buildDetailRows,
  buildEmailDocument,
  buildParagraph,
  escapeHtml,
  finishEmailText,
} from '../../../../core/email/templates/email-template.util';

export function buildLoanApplicationReceivedEmail(params: {
  fullname: string;
  brandName: string;
  loanAmount: number;
  numWeeks: number;
  expectedReturnAmount?: number | null;
  interestRate?: number | null;
  loanTypeName?: string;
}): { subject: string; html: string; text: string } {
  const subject = 'We received your loan application';
  const amountLabel = formatCurrency(params.loanAmount);
  const duration = formatDurationWeeks(params.numWeeks);

  const html = buildEmailDocument({
    subject,
    eyebrow: 'Loan application',
    icon: 'neutral',
    heading: 'Application received',
    bodyHtml: [
      buildParagraph(
        `Dear ${escapeHtml(params.fullname)}, ${escapeHtml(params.brandName)} has received your loan application. It is now with their team for review.`,
      ),
      buildDetailRows([
        { label: 'Organization', value: params.brandName },
        ...(params.loanTypeName
          ? [{ label: 'Loan product', value: params.loanTypeName }]
          : []),
        { label: 'Amount requested', value: amountLabel },
        { label: 'Duration', value: duration },
        ...(params.expectedReturnAmount != null
          ? [
              {
                label: 'Estimated amount to repay',
                value: formatCurrency(params.expectedReturnAmount),
              },
            ]
          : []),
        ...(params.interestRate != null
          ? [{ label: 'Interest rate', value: `${params.interestRate}%` }]
          : []),
      ]),
      buildParagraph(
        'This is an acknowledgement only. Approval is not automatic. You will receive another email when a decision is made.',
      ),
    ].join(''),
  });

  const text = finishEmailText([
    `Dear ${params.fullname},`,
    '',
    `${params.brandName} has received your loan application. It is now with their team for review.`,
    '',
    `Organization: ${params.brandName}`,
    ...(params.loanTypeName ? [`Loan product: ${params.loanTypeName}`] : []),
    `Amount requested: ${amountLabel}`,
    `Duration: ${duration}`,
    ...(params.expectedReturnAmount != null
      ? [
          `Estimated amount to repay: ${formatCurrency(params.expectedReturnAmount)}`,
        ]
      : []),
    ...(params.interestRate != null
      ? [`Interest rate: ${params.interestRate}%`]
      : []),
    '',
    'This is an acknowledgement only. Approval is not automatic. You will receive another email when a decision is made.',
  ]);

  return { subject, html, text };
}
