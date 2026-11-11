import { describe, expect, it, jest } from '@jest/globals';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AUDIT_LOG_EVENT } from '../constants/audit-events.constant';
import { AUDIT_DISPLAY_CATEGORIES } from '../constants/audit-display.constant';
import { AuditEmitterService } from './audit-emitter.service';

describe('AuditEmitterService', () => {
  it('emits a normalized display payload without changing the emit signature', () => {
    const eventEmitter = { emit: jest.fn() };
    const service = new AuditEmitterService(
      eventEmitter as unknown as EventEmitter2,
    );

    service.emit({
      module: 'LOANS',
      action: 'LOAN_ISSUED',
      targetType: 'Loan',
      targetId: 'loan-1',
      payload: { loanAmount: 1000, numWeeks: 4 },
    });

    expect(eventEmitter.emit).toHaveBeenCalledWith(AUDIT_LOG_EVENT, {
      module: 'LOANS',
      action: 'LOAN_ISSUED',
      targetType: 'Loan',
      targetId: 'loan-1',
      payload: {
        display: {
          category: AUDIT_DISPLAY_CATEGORIES.METADATA,
          changes: [
            { field: 'loanAmount', from: null, to: 1000 },
            { field: 'numWeeks', from: null, to: 4 },
          ],
        },
      },
    });
  });

  it('fans a related parent row with a pointer back to the primary target', () => {
    const eventEmitter = { emit: jest.fn() };
    const service = new AuditEmitterService(
      eventEmitter as unknown as EventEmitter2,
    );

    service.emitRelated(
      {
        userId: 1,
        userEmail: 'staff@test.com',
        tenantId: 'tenant-1',
        module: 'REPAYMENTS',
        action: 'REPAYMENT_RECORDED',
        targetType: 'Repayment',
        targetId: 'repay-1',
        payload: { amount: 500, loanId: 'loan-pub-1' },
      },
      {
        module: 'LOANS',
        action: 'LOAN_REPAYMENT_RECORDED',
        targetType: 'Loan',
        targetId: 'loan-pub-1',
        payload: { amount: 500, cleared: false },
      },
    );

    expect(eventEmitter.emit).toHaveBeenCalledTimes(2);
    expect(eventEmitter.emit).toHaveBeenNthCalledWith(
      1,
      AUDIT_LOG_EVENT,
      expect.objectContaining({
        module: 'REPAYMENTS',
        action: 'REPAYMENT_RECORDED',
        targetType: 'Repayment',
        targetId: 'repay-1',
      }),
    );
    expect(eventEmitter.emit).toHaveBeenNthCalledWith(
      2,
      AUDIT_LOG_EVENT,
      expect.objectContaining({
        userId: 1,
        tenantId: 'tenant-1',
        module: 'LOANS',
        action: 'LOAN_REPAYMENT_RECORDED',
        targetType: 'Loan',
        targetId: 'loan-pub-1',
        payload: {
          display: {
            category: AUDIT_DISPLAY_CATEGORIES.METADATA,
            changes: [
              { field: 'relatedTargetType', from: null, to: 'Repayment' },
              { field: 'relatedTargetId', from: null, to: 'repay-1' },
              { field: 'amount', from: null, to: 500 },
              { field: 'cleared', from: null, to: false },
            ],
          },
        },
      }),
    );
  });
});
