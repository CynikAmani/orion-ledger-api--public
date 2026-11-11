import { describe, expect, it } from '@jest/globals';
import { AUDIT_DISPLAY_CATEGORIES } from '../constants/audit-display.constant';
import { normalizeAuditPayload } from './normalize-audit-payload.util';

describe('normalizeAuditPayload', () => {
  it('uses METADATA with an empty change list when no payload is provided', () => {
    expect(normalizeAuditPayload(undefined, 'USER_DELETED')).toEqual({
      display: {
        category: AUDIT_DISPLAY_CATEGORIES.METADATA,
        changes: [],
      },
    });
  });

  it('normalizes DTO snapshots into a uniform change list', () => {
    expect(
      normalizeAuditPayload(
        { loanAmount: 5000, numWeeks: 8, customerId: 'user-1' },
        'LOAN_ISSUED',
      ),
    ).toEqual({
      display: {
        category: AUDIT_DISPLAY_CATEGORIES.METADATA,
        changes: [
          { field: 'loanAmount', from: null, to: 5000 },
          { field: 'numWeeks', from: null, to: 8 },
          { field: 'customerId', from: null, to: 'user-1' },
        ],
      },
    });
  });

  it('maps previous/current pairs onto one TRANSITION change per attribute', () => {
    expect(
      normalizeAuditPayload(
        {
          previousStatus: 'OPEN',
          status: 'RESOLVED',
          previousPriority: 'LOW',
          priority: 'HIGH',
          ticketNumber: 'T-100',
        },
        'SUPPORT_TICKET_STATUS_UPDATED',
      ),
    ).toEqual({
      display: {
        category: AUDIT_DISPLAY_CATEGORIES.TRANSITION,
        changes: [
          { field: 'status', from: 'OPEN', to: 'RESOLVED' },
          { field: 'priority', from: 'LOW', to: 'HIGH' },
          { field: 'ticketNumber', from: null, to: 'T-100' },
        ],
      },
    });
  });

  it('maps previous/next keys onto a single field name', () => {
    expect(
      normalizeAuditPayload(
        {
          previousRolePublicIds: ['role-a'],
          nextRolePublicIds: ['role-b', 'role-c'],
        },
        'USER_ROLES_ASSIGNED',
      ),
    ).toEqual({
      display: {
        category: AUDIT_DISPLAY_CATEGORIES.TRANSITION,
        changes: [
          {
            field: 'rolePublicIds',
            from: ['role-a'],
            to: ['role-b', 'role-c'],
          },
        ],
      },
    });
  });

  it('maps generic from/to on status actions to a status change', () => {
    expect(
      normalizeAuditPayload(
        { from: 'DRAFT', to: 'PUBLISHED', type: 'TERMS_OF_SERVICE' },
        'AGREEMENT_STATUS_CHANGED',
      ),
    ).toEqual({
      display: {
        category: AUDIT_DISPLAY_CATEGORIES.TRANSITION,
        changes: [
          { field: 'status', from: 'DRAFT', to: 'PUBLISHED' },
          { field: 'type', from: null, to: 'TERMS_OF_SERVICE' },
        ],
      },
    });
  });

  it('treats status-transition operations as TRANSITION', () => {
    expect(
      normalizeAuditPayload(
        { operation: 'status-transition', status: 'ACTIVE' },
        'ADVERT_UPDATED',
      ),
    ).toEqual({
      display: {
        category: AUDIT_DISPLAY_CATEGORIES.TRANSITION,
        changes: [
          { field: 'operation', from: null, to: 'status-transition' },
          { field: 'status', from: null, to: 'ACTIVE' },
        ],
      },
    });
  });

  it('flattens approval proposed-field maps into the same change rows', () => {
    expect(
      normalizeAuditPayload(
        {
          entityType: 'TENANT',
          changes: { slug: 'acme', name: 'Acme Ltd' },
        },
        'APPROVAL_REQUEST_SUBMITTED',
      ),
    ).toEqual({
      display: {
        category: AUDIT_DISPLAY_CATEGORIES.APPROVAL,
        changes: [
          { field: 'slug', from: null, to: 'acme' },
          { field: 'name', from: null, to: 'Acme Ltd' },
          { field: 'entityType', from: null, to: 'TENANT' },
        ],
      },
    });
  });

  it('flattens applied approval maps and rejection reasons', () => {
    expect(
      normalizeAuditPayload(
        {
          entityType: 'TENANT',
          applied: { slug: 'acme' },
          tenantUuid: 'tenant-1',
        },
        'APPROVAL_REQUEST_APPROVED',
      ),
    ).toEqual({
      display: {
        category: AUDIT_DISPLAY_CATEGORIES.APPROVAL,
        changes: [
          { field: 'slug', from: null, to: 'acme' },
          { field: 'entityType', from: null, to: 'TENANT' },
          { field: 'tenantUuid', from: null, to: 'tenant-1' },
        ],
      },
    });

    expect(
      normalizeAuditPayload(
        { entityType: 'TENANT', rejectionReason: 'Incomplete' },
        'APPROVAL_REQUEST_REJECTED',
      ),
    ).toEqual({
      display: {
        category: AUDIT_DISPLAY_CATEGORIES.APPROVAL,
        changes: [
          { field: 'entityType', from: null, to: 'TENANT' },
          { field: 'rejectionReason', from: null, to: 'Incomplete' },
        ],
      },
    });
  });

  it('classifies file metadata as FILE with one change per attribute', () => {
    expect(
      normalizeAuditPayload(
        {
          originalname: 'logo.png',
          mimetype: 'image/png',
          size: 2048,
          logoImgName: 'stored-logo.png',
        },
        'BRAND_LOGO_UPDATED',
      ),
    ).toEqual({
      display: {
        category: AUDIT_DISPLAY_CATEGORIES.FILE,
        changes: [
          { field: 'originalname', from: null, to: 'logo.png' },
          { field: 'mimetype', from: null, to: 'image/png' },
          { field: 'size', from: null, to: 2048 },
          { field: 'logoImgName', from: null, to: 'stored-logo.png' },
        ],
      },
    });
  });

  it('maps image replacement pairs as FILE changes', () => {
    expect(
      normalizeAuditPayload(
        {
          title: 'Summer',
          previousImageUrl: 'old.png',
          imageUrl: 'new.png',
        },
        'BRAND_SHOWCASE_UPDATED',
      ),
    ).toEqual({
      display: {
        category: AUDIT_DISPLAY_CATEGORIES.FILE,
        changes: [
          { field: 'imageUrl', from: 'old.png', to: 'new.png' },
          { field: 'title', from: null, to: 'Summer' },
        ],
      },
    });
  });

  it('classifies identity-document flags as FILE', () => {
    expect(
      normalizeAuditPayload(
        { replacedIdentityDocument: true, replacedSignature: false },
        'USER_IDENTITY_DOCUMENT_UPSERTED',
      ),
    ).toEqual({
      display: {
        category: AUDIT_DISPLAY_CATEGORIES.FILE,
        changes: [
          { field: 'replacedIdentityDocument', from: null, to: true },
          { field: 'replacedSignature', from: null, to: false },
        ],
      },
    });
  });

  it('redacts sensitive keys while keeping the change row', () => {
    expect(
      normalizeAuditPayload(
        { email: 'a@b.c', password: 'hunter2', passwordResetPin: '1234' },
        'USER_UPDATED',
      ),
    ).toEqual({
      display: {
        category: AUDIT_DISPLAY_CATEGORIES.METADATA,
        changes: [
          { field: 'email', from: null, to: 'a@b.c' },
          { field: 'password', from: null, to: '[REDACTED]' },
          { field: 'passwordResetPin', from: null, to: '[REDACTED]' },
        ],
      },
    });
  });

  it('serializes dates and decimal-like values', () => {
    const start = new Date('2026-01-15T00:00:00.000Z');
    expect(
      normalizeAuditPayload(
        {
          startDate: start,
          discount: { toNumber: () => 12.5 },
        },
        'PROMOTION_CREATED',
      ),
    ).toEqual({
      display: {
        category: AUDIT_DISPLAY_CATEGORIES.METADATA,
        changes: [
          { field: 'startDate', from: null, to: '2026-01-15T00:00:00.000Z' },
          { field: 'discount', from: null, to: 12.5 },
        ],
      },
    });
  });

  it('is idempotent when the payload is already normalized', () => {
    const normalized = normalizeAuditPayload(
      { previousValue: false, nextValue: true },
      'USER_BLOCKED',
    );

    expect(normalizeAuditPayload(normalized, 'USER_BLOCKED')).toEqual({
      display: {
        category: AUDIT_DISPLAY_CATEGORIES.TRANSITION,
        changes: [{ field: 'value', from: false, to: true }],
      },
    });
  });
});
