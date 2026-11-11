import {
  NOTIFICATION_ACTIONS,
  PLATFORM_NOTIFICATION_ACTIONS,
  TENANT_NOTIFICATION_ACTIONS,
} from '../constants/notification-action-keys.constant';
import {
  buildDetailRows,
  buildEmailDocument,
  buildParagraph,
  escapeHtml,
  finishEmailText,
  type EmailDetailRow,
  type EmailIconVariant,
} from '../../email/templates/email-template.util';

export function buildStaffDispatchEmail(params: {
  actionKey: string;
  recipientName: string;
  subject: string;
  message: string;
  templateData?: Record<string, unknown>;
}): { html: string; text: string } {
  const data = params.templateData ?? {};
  const spec = resolveStaffSpec(
    params.actionKey,
    params.subject,
    params.message,
    data,
  );
  const greeting = `Hello ${params.recipientName},`;

  const html = buildEmailDocument({
    subject: params.subject,
    eyebrow: spec.eyebrow,
    eyebrowColor: spec.eyebrowColor,
    icon: spec.icon,
    heading: spec.heading,
    bodyHtml: [
      buildParagraph(escapeHtml(greeting)),
      buildParagraph(escapeHtml(spec.intro)),
      buildDetailRows(spec.rows),
      spec.closing ? buildParagraph(escapeHtml(spec.closing)) : '',
    ].join(''),
  });

  const text = finishEmailText([
    greeting,
    '',
    spec.intro,
    '',
    ...spec.rows.map((row) => `${row.label}: ${row.value}`),
    ...(spec.closing ? ['', spec.closing] : []),
  ]);

  return { html, text };
}

interface StaffSpec {
  eyebrow: string;
  eyebrowColor?: string;
  icon: EmailIconVariant;
  heading: string;
  intro: string;
  rows: EmailDetailRow[];
  closing?: string;
}

function resolveStaffSpec(
  actionKey: string,
  subject: string,
  fallbackMessage: string,
  data: Record<string, unknown>,
): StaffSpec {
  const organization = str(data, 'organization');
  const customer = str(data, 'customerName');
  const loanType = str(data, 'loanTypeName');

  switch (actionKey) {
    case TENANT_NOTIFICATION_ACTIONS.REPAYMENTS.RECORDED:
      return {
        eyebrow: 'Repayment',
        icon: 'success',
        heading: bool(data, 'cleared')
          ? 'Final repayment recorded'
          : 'Repayment recorded',
        intro: bool(data, 'cleared')
          ? `${customer || 'A customer'} has completed repayment${withOrganization(organization)}. The loan is fully settled.`
          : `A repayment has been recorded for ${customer || 'a customer'}${withOrganization(organization)}. The outstanding balance is updated below.`,
        rows: compactRows([
          { label: 'Organization', value: organization },
          { label: 'Customer', value: customer },
          { label: 'Loan product', value: loanType },
          { label: 'Amount received', value: str(data, 'repaidAmount') },
          { label: 'Paid to date', value: str(data, 'amountPaidToDate') },
          { label: 'Remaining balance', value: str(data, 'remainingBalance') },
          { label: 'Share paid', value: str(data, 'percentPaid') },
          { label: 'Total to repay', value: str(data, 'returnAmount') },
          { label: 'Due date', value: str(data, 'dueDate') },
        ]),
        closing:
          'Open the loan record if you need to confirm the receipt or follow up.',
      };

    case TENANT_NOTIFICATION_ACTIONS.LOANS.CLEARED:
      return {
        eyebrow: 'Loan cleared',
        icon: 'success',
        heading: 'Loan fully repaid',
        intro: `The loan for ${customer || 'the customer'} is cleared${withOrganization(organization)}. No further instalments are due.`,
        rows: compactRows([
          { label: 'Organization', value: organization },
          { label: 'Customer', value: customer },
          { label: 'Loan product', value: loanType },
          { label: 'Amount issued', value: str(data, 'loanAmount') },
          { label: 'Total repaid', value: str(data, 'returnAmount') },
          { label: 'Share paid', value: str(data, 'percentPaid') || '100%' },
        ]),
        closing: 'The customer account is in good standing for this loan.',
      };

    case TENANT_NOTIFICATION_ACTIONS.LOANS.ISSUED:
      return {
        eyebrow: 'Loan issued',
        icon: 'neutral',
        heading: 'New loan on the books',
        intro: `A loan has been issued to ${customer || 'a customer'}${withOrganization(organization)}. Terms are summarised below.`,
        rows: compactRows([
          { label: 'Organization', value: organization },
          { label: 'Customer', value: customer },
          { label: 'Loan product', value: loanType },
          { label: 'Amount issued', value: str(data, 'loanAmount') },
          { label: 'Amount to repay', value: str(data, 'returnAmount') },
          { label: 'Interest rate', value: rateLabel(data) },
          { label: 'Duration', value: str(data, 'duration') },
          { label: 'Start date', value: str(data, 'startDate') },
          { label: 'Due date', value: str(data, 'dueDate') },
          { label: 'Collateral', value: str(data, 'collateral') },
        ]),
        closing: 'The customer can view the same figures on their account.',
      };

    case TENANT_NOTIFICATION_ACTIONS.LOANS.OVERDUE:
      return {
        eyebrow: 'Overdue',
        eyebrowColor: '#b45309',
        icon: 'warning',
        heading: 'Loan past due',
        intro: `${customer || 'A customer'} has a loan past its due date${withOrganization(organization)}. Follow up on collection.`,
        rows: compactRows([
          { label: 'Organization', value: organization },
          { label: 'Customer', value: customer },
          { label: 'Loan product', value: loanType },
          {
            label: 'Outstanding balance',
            value: str(data, 'remainingBalance'),
          },
          { label: 'Share paid', value: str(data, 'percentPaid') },
          { label: 'Total to repay', value: str(data, 'returnAmount') },
          { label: 'Due date', value: str(data, 'dueDate') },
        ]),
        closing:
          'The customer account is on a business-activity hold until this is resolved.',
      };

    case TENANT_NOTIFICATION_ACTIONS.LOANS.DEFAULTED:
      return {
        eyebrow: 'Default',
        eyebrowColor: '#b45309',
        icon: 'warning',
        heading: 'Loan marked as defaulted',
        intro: `The loan for ${customer || 'a customer'} has been marked defaulted${withOrganization(organization)}. The account is blocked for further lending until it is reviewed.`,
        rows: compactRows([
          { label: 'Organization', value: organization },
          { label: 'Customer', value: customer },
          { label: 'Loan product', value: loanType },
          {
            label: 'Outstanding balance',
            value: str(data, 'remainingBalance'),
          },
          { label: 'Amount issued', value: str(data, 'loanAmount') },
          { label: 'Total to repay', value: str(data, 'returnAmount') },
          { label: 'Due date', value: str(data, 'dueDate') },
        ]),
      };

    case TENANT_NOTIFICATION_ACTIONS.LOAN_APPLICATIONS.SUBMITTED:
      return {
        eyebrow: 'Application',
        icon: 'neutral',
        heading: 'New loan application',
        intro: `${customer || 'A customer'} submitted a loan application${withOrganization(organization)}. It is waiting for review.`,
        rows: compactRows([
          { label: 'Organization', value: organization },
          { label: 'Applicant', value: customer },
          { label: 'Loan product', value: loanType },
          { label: 'Amount requested', value: str(data, 'loanAmount') },
          { label: 'Expected repayment', value: str(data, 'returnAmount') },
          { label: 'Interest rate', value: rateLabel(data) },
          { label: 'Duration', value: str(data, 'duration') },
          { label: 'Location', value: str(data, 'location') },
          { label: 'Collateral', value: str(data, 'collateral') },
          { label: 'Submitted', value: str(data, 'submittedAt') },
        ]),
        closing: 'Open Applications to review or decide.',
      };

    case TENANT_NOTIFICATION_ACTIONS.SUPPORT.TICKET_CREATED:
      return {
        eyebrow: 'Support',
        icon: 'neutral',
        heading: 'New support ticket',
        intro: `${customer || 'A customer'} opened a support ticket${withOrganization(organization)}. A reply from staff is needed.`,
        rows: compactRows([
          { label: 'Organization', value: organization },
          { label: 'Customer', value: customer },
          { label: 'Ticket', value: str(data, 'ticketNumber') },
          { label: 'Category', value: str(data, 'ticketCategory') },
        ]),
        closing: 'Open Support to read the message and respond.',
      };

    case TENANT_NOTIFICATION_ACTIONS.SUPPORT.CUSTOMER_REPLIED:
      return {
        eyebrow: 'Support',
        icon: 'neutral',
        heading: 'Customer replied',
        intro: `${customer || 'A customer'} added a message on an open support ticket${withOrganization(organization)}.`,
        rows: compactRows([
          { label: 'Organization', value: organization },
          { label: 'Customer', value: customer },
          { label: 'Ticket', value: str(data, 'ticketNumber') },
          { label: 'Category', value: str(data, 'ticketCategory') },
        ]),
        closing: 'Open Support to read the reply and continue the thread.',
      };

    case PLATFORM_NOTIFICATION_ACTIONS.SUBSCRIPTIONS.CREATED:
      return {
        eyebrow: 'Subscription',
        icon: 'success',
        heading: 'Tenant subscription recorded',
        intro: `A subscription was recorded for ${organization || 'a tenant'}.`,
        rows: compactRows([
          { label: 'Organization', value: organization },
          { label: 'Plan', value: str(data, 'planName') },
          { label: 'Amount', value: str(data, 'amount') },
          { label: 'Payment method', value: str(data, 'paymentMethod') },
          { label: 'Reference', value: str(data, 'transactionReference') },
          { label: 'Starts', value: str(data, 'startsAt') },
          { label: 'Ends', value: str(data, 'endsAt') },
        ]),
      };

    case PLATFORM_NOTIFICATION_ACTIONS.SANDBOX.VISIT_STARTED:
      return {
        eyebrow: 'Sandbox',
        icon: 'neutral',
        heading: 'Demo session started',
        intro: `A visitor started a demo session on ${organization || 'a demo institution'}. Changes they make stay on that institution.`,
        rows: compactRows([
          { label: 'Organization', value: organization },
          { label: 'Workspace slug', value: str(data, 'slug') },
          { label: 'Session ends', value: str(data, 'endsAt') },
        ]),
      };

    case PLATFORM_NOTIFICATION_ACTIONS.BRAND_ONBOARDING.SUBMITTED:
      return {
        eyebrow: 'Brand onboarding',
        icon: 'neutral',
        heading: 'Brand registration requested',
        intro: `${organization || 'A brand'} submitted a registration request for review.`,
        rows: compactRows([
          { label: 'Organization', value: organization },
          { label: 'Workspace slug', value: str(data, 'slug') },
          { label: 'Tenant code', value: str(data, 'tenantCode') },
          { label: 'Contact email', value: str(data, 'contactEmail') },
        ]),
        closing: 'Open brand requests to approve or decline.',
      };

    case NOTIFICATION_ACTIONS.PROMOTIONS.ACTIVATED:
    case NOTIFICATION_ACTIONS.PROMOTIONS.EXPIRING_SOON:
    case NOTIFICATION_ACTIONS.PROMOTIONS.CANCELLED:
      return {
        eyebrow: 'Promotion',
        eyebrowColor:
          actionKey === NOTIFICATION_ACTIONS.PROMOTIONS.ACTIVATED
            ? undefined
            : '#b45309',
        icon:
          actionKey === NOTIFICATION_ACTIONS.PROMOTIONS.ACTIVATED
            ? 'success'
            : 'warning',
        heading: subject,
        intro: fallbackMessage,
        rows: compactRows([
          { label: 'Organization', value: organization },
          { label: 'Discount', value: str(data, 'discount') },
          { label: 'Starts', value: str(data, 'startDate') },
          { label: 'Ends', value: str(data, 'endDate') },
        ]),
      };

    case NOTIFICATION_ACTIONS.SPECIAL_OFFERS.ISSUED_AUTOMATED:
      return {
        eyebrow: 'Special offer',
        icon: 'success',
        heading: 'Loyalty offer issued',
        intro: `A loyalty offer was issued to ${customer || 'a customer'}${withOrganization(organization)}. Cancel it in Special Offers if it should not stand.`,
        rows: compactRows([
          { label: 'Organization', value: organization },
          { label: 'Customer', value: customer },
          { label: 'Offer', value: str(data, 'offerLabel') },
          { label: 'Expires', value: str(data, 'expiresAt') },
        ]),
      };

    case NOTIFICATION_ACTIONS.AGREEMENTS.CREATED:
    case NOTIFICATION_ACTIONS.AGREEMENTS.UPDATED:
    case NOTIFICATION_ACTIONS.AGREEMENTS.PUBLISHED:
    case NOTIFICATION_ACTIONS.AGREEMENTS.ARCHIVED:
      return {
        eyebrow: 'Agreements',
        icon: 'neutral',
        heading: subject,
        intro: fallbackMessage,
        rows: compactRows([
          { label: 'Organization', value: organization },
          { label: 'Document', value: str(data, 'agreementType') },
          { label: 'Title', value: str(data, 'title') },
          { label: 'Version', value: str(data, 'version') },
        ]),
      };

    default:
      return {
        eyebrow: 'Notification',
        icon: 'neutral',
        heading: subject,
        intro: fallbackMessage,
        rows: compactRows([{ label: 'Organization', value: organization }]),
      };
  }
}

function withOrganization(organization: string): string {
  return organization ? ` at ${organization}` : '';
}

function compactRows(rows: EmailDetailRow[]): EmailDetailRow[] {
  return rows.filter((row) => row.value.trim().length > 0);
}

function str(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

function bool(data: Record<string, unknown>, key: string): boolean {
  return data[key] === true;
}

function rateLabel(data: Record<string, unknown>): string {
  const raw = data.interestRate;
  if (typeof raw === 'number') {
    return `${raw}%`;
  }
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw.includes('%') ? raw : `${raw}%`;
  }
  return '';
}
