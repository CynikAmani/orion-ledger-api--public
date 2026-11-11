import { describe, expect, it } from '@jest/globals';
import {
  PLATFORM_NOTIFICATION_ACTIONS,
  TENANT_NOTIFICATION_ACTIONS,
} from '../constants/notification-action-keys.constant';
import { buildStaffDispatchEmail } from './staff-dispatch.email';

describe('buildStaffDispatchEmail', () => {
  it('names the tenant organization and the repayment figures', () => {
    const email = buildStaffDispatchEmail({
      actionKey: TENANT_NOTIFICATION_ACTIONS.REPAYMENTS.RECORDED,
      recipientName: 'Alex Banda',
      subject: 'Loan repayment recorded',
      message: 'Repayment recorded',
      templateData: {
        organization: 'Acme Credit',
        customerName: 'Jane Phiri',
        loanTypeName: 'Standard',
        repaidAmount: 'MWK 10,000',
        remainingBalance: 'MWK 40,000',
        cleared: false,
      },
    });

    expect(email.html).toContain('Orion Systems');
    expect(email.html).toContain('Acme Credit');
    expect(email.html).toContain('Jane Phiri');
    expect(email.html).toContain('MWK 10,000');
    expect(email.text).toContain('Organization: Acme Credit');
    expect(email.text).toContain('Hello Alex Banda,');
  });

  it('describes a sandbox visit for the configured platform roles', () => {
    const email = buildStaffDispatchEmail({
      actionKey: PLATFORM_NOTIFICATION_ACTIONS.SANDBOX.VISIT_STARTED,
      recipientName: 'Alex Banda',
      subject: 'Sandbox visit started',
      message: 'A visitor started a demo session on Acme Credit.',
      templateData: {
        organization: 'Acme Credit',
        slug: 'acme-credit',
        endsAt: '08 Nov 2026, 22:32',
      },
    });

    expect(email.html).toContain('Demo session started');
    expect(email.html).toContain('Acme Credit');
    expect(email.html).toContain('acme-credit');
    expect(email.text).toContain('Session ends: 08 Nov 2026, 22:32');
  });

  it('falls back to the dispatch message when the action has no dedicated layout', () => {
    const email = buildStaffDispatchEmail({
      actionKey: 'unknown:event',
      recipientName: 'Alex Banda',
      subject: 'Something happened',
      message: 'A record changed at the tenant.',
      templateData: { organization: 'Acme Credit' },
    });

    expect(email.html).toContain('Something happened');
    expect(email.html).toContain('A record changed at the tenant.');
    expect(email.text).toContain('Organization: Acme Credit');
  });
});
