export const AUDIT_DISPLAY_CATEGORIES = {
  TRANSITION: 'TRANSITION',
  APPROVAL: 'APPROVAL',
  FILE: 'FILE',
  METADATA: 'METADATA',
} as const;

export type AuditDisplayCategory =
  (typeof AUDIT_DISPLAY_CATEGORIES)[keyof typeof AUDIT_DISPLAY_CATEGORIES];

export const AUDIT_REDACTED_VALUE = '[REDACTED]';

export const AUDIT_SENSITIVE_KEY_FRAGMENTS = [
  'password',
  'pin',
  'token',
  'secret',
] as const;

const FILE_SIGNAL_KEYS = new Set([
  'mimetype',
  'originalname',
  'logoimgname',
  'replacedidentitydocument',
  'replacedsignature',
]);

export function isSensitiveAuditKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[_-]/g, '');
  return AUDIT_SENSITIVE_KEY_FRAGMENTS.some((fragment) =>
    normalized.includes(fragment),
  );
}

export function isFileSignalKey(key: string): boolean {
  return FILE_SIGNAL_KEYS.has(key.toLowerCase());
}
