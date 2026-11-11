import {
  AUDIT_DISPLAY_CATEGORIES,
  AUDIT_REDACTED_VALUE,
  isFileSignalKey,
  isSensitiveAuditKey,
  type AuditDisplayCategory,
} from '../constants/audit-display.constant';
import type {
  AuditDisplayChange,
  NormalizedAuditPayload,
} from '../interfaces/audit-display.interface';

const NESTED_APPROVAL_MAP_KEYS = ['changes', 'applied'] as const;

export function normalizeAuditPayload(
  payload: unknown,
  action?: string,
): NormalizedAuditPayload {
  if (isNormalizedAuditPayload(payload)) {
    return sanitizeNormalizedPayload(payload);
  }

  const source = isPlainObject(payload) ? payload : {};
  const category = classifyAuditPayload(source, action);
  const changes = extractChanges(source, action);

  return {
    display: {
      category,
      changes,
    },
  };
}

export function isNormalizedAuditPayload(
  value: unknown,
): value is NormalizedAuditPayload {
  if (!isPlainObject(value) || !isPlainObject(value.display)) {
    return false;
  }

  const { category, changes } = value.display;
  if (!isAuditDisplayCategory(category) || !Array.isArray(changes)) {
    return false;
  }

  return changes.every(isAuditDisplayChange);
}

function classifyAuditPayload(
  source: Record<string, unknown>,
  action?: string,
): AuditDisplayCategory {
  if (isApprovalPayload(source, action)) {
    return AUDIT_DISPLAY_CATEGORIES.APPROVAL;
  }

  if (isFilePayload(source, action)) {
    return AUDIT_DISPLAY_CATEGORIES.FILE;
  }

  if (isTransitionPayload(source)) {
    return AUDIT_DISPLAY_CATEGORIES.TRANSITION;
  }

  return AUDIT_DISPLAY_CATEGORIES.METADATA;
}

function isApprovalPayload(
  source: Record<string, unknown>,
  action?: string,
): boolean {
  if (includesActionToken(action, 'APPROVAL')) {
    return true;
  }

  if (typeof source.entityType !== 'string') {
    return false;
  }

  return (
    NESTED_APPROVAL_MAP_KEYS.some((key) => isPlainObject(source[key])) ||
    source.rejectionReason !== undefined
  );
}

function isFilePayload(
  source: Record<string, unknown>,
  action?: string,
): boolean {
  if (
    includesActionToken(action, 'LOGO') ||
    includesActionToken(action, 'AVATAR') ||
    includesActionToken(action, 'IDENTITY_DOCUMENT')
  ) {
    return true;
  }

  if (
    source.previousImageUrl !== undefined &&
    source.imageUrl !== undefined
  ) {
    return true;
  }

  return Object.keys(source).some((key) => isFileSignalKey(key));
}

function isTransitionPayload(source: Record<string, unknown>): boolean {
  if (source.operation === 'status-transition') {
    return true;
  }

  if (hasPair(source, 'from', 'to') || hasPair(source, 'before', 'after')) {
    return true;
  }

  return Object.keys(source).some((key) => {
    const counterpart = findPreviousCounterpart(source, key);
    return counterpart !== undefined;
  });
}

function extractChanges(
  source: Record<string, unknown>,
  action?: string,
): AuditDisplayChange[] {
  const consumed = new Set<string>();
  const changes: AuditDisplayChange[] = [];

  for (const key of NESTED_APPROVAL_MAP_KEYS) {
    const nested = source[key];
    if (!isPlainObject(nested)) {
      continue;
    }

    consumed.add(key);
    for (const [field, value] of Object.entries(nested)) {
      changes.push(toChange(field, null, value));
    }
  }

  pushPair(changes, consumed, source, 'from', 'to', inferFromToField(action));
  pushPair(changes, consumed, source, 'before', 'after', 'value');

  for (const key of Object.keys(source)) {
    const counterpart = findPreviousCounterpart(source, key);
    if (!counterpart) {
      continue;
    }

    consumed.add(key);
    consumed.add(counterpart.toKey);
    changes.push(
      toChange(counterpart.field, source[key], source[counterpart.toKey]),
    );
  }

  for (const [field, value] of Object.entries(source)) {
    if (consumed.has(field) || value === undefined) {
      continue;
    }

    changes.push(toChange(field, null, value));
  }

  return changes;
}

function findPreviousCounterpart(
  source: Record<string, unknown>,
  key: string,
): { field: string; toKey: string } | undefined {
  if (!key.startsWith('previous') || key.length <= 'previous'.length) {
    return undefined;
  }

  const suffix = key.slice('previous'.length);
  const field = suffix.charAt(0).toLowerCase() + suffix.slice(1);
  const nextKey = `next${suffix}`;

  if (Object.prototype.hasOwnProperty.call(source, nextKey)) {
    return { field, toKey: nextKey };
  }

  if (Object.prototype.hasOwnProperty.call(source, field)) {
    return { field, toKey: field };
  }

  return undefined;
}

function pushPair(
  changes: AuditDisplayChange[],
  consumed: Set<string>,
  source: Record<string, unknown>,
  fromKey: string,
  toKey: string,
  field: string,
): void {
  if (!hasPair(source, fromKey, toKey)) {
    return;
  }

  consumed.add(fromKey);
  consumed.add(toKey);
  changes.push(toChange(field, source[fromKey], source[toKey]));
}

function toChange(field: string, from: unknown, to: unknown): AuditDisplayChange {
  return {
    field,
    from: toJsonSafeValue(field, from),
    to: toJsonSafeValue(field, to),
  };
}

function toJsonSafeValue(field: string, value: unknown): unknown {
  if (value === undefined || value === null) {
    return null;
  }

  if (isSensitiveAuditKey(field)) {
    return AUDIT_REDACTED_VALUE;
  }

  return toJsonSafe(value);
}

function toJsonSafe(value: unknown): unknown {
  if (value === undefined) {
    return null;
  }

  if (value === null) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : String(value);
  }

  if (typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => toJsonSafe(item));
  }

  if (isDecimalLike(value)) {
    return value.toNumber();
  }

  const result: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    result[key] = isSensitiveAuditKey(key)
      ? AUDIT_REDACTED_VALUE
      : toJsonSafe(nested);
  }

  return result;
}

function sanitizeNormalizedPayload(
  payload: NormalizedAuditPayload,
): NormalizedAuditPayload {
  return {
    display: {
      category: payload.display.category,
      changes: payload.display.changes.map((change) =>
        toChange(change.field, change.from, change.to),
      ),
    },
  };
}

function inferFromToField(action?: string): string {
  return includesActionToken(action, 'STATUS') ? 'status' : 'value';
}

function includesActionToken(action: string | undefined, token: string): boolean {
  return (action ?? '').toUpperCase().includes(token);
}

function hasPair(
  source: Record<string, unknown>,
  fromKey: string,
  toKey: string,
): boolean {
  return (
    Object.prototype.hasOwnProperty.call(source, fromKey) &&
    Object.prototype.hasOwnProperty.call(source, toKey)
  );
}

function isAuditDisplayCategory(value: unknown): value is AuditDisplayCategory {
  return (
    typeof value === 'string' &&
    Object.values(AUDIT_DISPLAY_CATEGORIES).includes(
      value as AuditDisplayCategory,
    )
  );
}

function isAuditDisplayChange(value: unknown): value is AuditDisplayChange {
  return (
    isPlainObject(value) &&
    typeof value.field === 'string' &&
    value.field.length > 0 &&
    Object.prototype.hasOwnProperty.call(value, 'from') &&
    Object.prototype.hasOwnProperty.call(value, 'to')
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  );
}

function isDecimalLike(
  value: object,
): value is { toNumber: () => number } {
  return (
    'toNumber' in value &&
    typeof (value as { toNumber?: unknown }).toNumber === 'function'
  );
}
