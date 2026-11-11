import type { AuditDisplayCategory } from '../constants/audit-display.constant';

/**
 * One row per attribute, regardless of how many fields the subscriber sent
 * or which key names they used (previousX/X, from/to, DTO snapshot, …).
 */
export interface AuditDisplayChange {
  field: string;
  from: unknown;
  to: unknown;
}

export interface AuditDisplay {
  category: AuditDisplayCategory;
  changes: AuditDisplayChange[];
}

/** JSON written to AuditLog.payload after emission/persist normalization. */
export interface NormalizedAuditPayload {
  display: AuditDisplay;
}
