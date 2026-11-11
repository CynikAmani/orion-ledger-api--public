import {
  PERMISSIONS,
  type PermissionType,
} from '../../../modules/auth/shared/constants/permissions.constant';

export type AuditModule = keyof typeof PERMISSIONS;

export const AUDIT_MODULES = Object.keys(PERMISSIONS) as AuditModule[];

/** Request-scoped actor fields passed from controllers into mutating services. */
export type AuditContext = Pick<
  AuditPayload,
  'userId' | 'userEmail' | 'ipAddress' | 'userAgent'
>;

export interface AuditPayload {
  userId?: number;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  /// NULL / omitted when the action is platform-wide
  tenantId?: string | null;
  module: AuditModule;
  /** Permission key (legacy) or descriptive action label (e.g. LOAN_TYPE_CREATED). */
  action: PermissionType | string;
  targetId?: string;
  targetType?: string;
  /**
   * Subscriber-owned snapshot. Normalized to `{ display: { category, changes } }`
   * on emit/persist — callers still pass raw DTO/transition/file maps.
   */
  payload?: Record<string, unknown>;
}
