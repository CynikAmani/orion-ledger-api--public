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

export function buildLoanApplicationDeclinedEmail(params: {
  fullname: string;
  brandName: string;
  loanAmount: number;
  numWeeks: number;
}): { subject: string; html: string; text: string } {
  const subject = 'Update on your loan application';
  const amountLabel = formatCurrency(params.loanAmount);
  const duration = formatDurationWeeks(params.numWeeks);

  const html = buildEmailDocument({
    subject,
    eyebrow: 'Loan application',
    eyebrowColor: '#b45309',
    icon: 'warning',
    heading: 'Application not approved',
    bodyHtml: [
      buildParagraph(
        `Dear ${escapeHtml(params.fullname)}, ${escapeHtml(params.brandName)} has reviewed your loan application and is unable to approve it at this time.`,
      ),
      buildDetailRows([
        { label: 'Organization', value: params.brandName },
        { label: 'Amount requested', value: amountLabel },
        { label: 'Duration', value: duration },
      ]),
      buildParagraph(
        'This decision applies to this application only. You may contact the organization if you would like an explanation, or submit a new application when you are ready.',
      ),
    ].join(''),
  });

  const text = finishEmailText([
    `Dear ${params.fullname},`,
    '',
    `${params.brandName} has reviewed your loan application and is unable to approve it at this time.`,
    '',
    `Organization: ${params.brandName}`,
    `Amount requested: ${amountLabel}`,
    `Duration: ${duration}`,
    '',
    'This decision applies to this application only. You may contact the organization if you would like an explanation, or submit a new application when you are ready.',
  ]);

  return { subject, html, text };
}
