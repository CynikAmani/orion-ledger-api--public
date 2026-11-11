import type { Request } from 'express';
import type { AuthenticatedRequest } from '../../../modules/auth/shared/guards/permission.guard';
import type { AuditContext } from '../interfaces/audit-payload.interface';

export function extractAuditRequestContext(
  request: AuthenticatedRequest,
): AuditContext {
  const userAgent = request.headers['user-agent'];

  return {
    userId: request.user.id,
    userEmail: request.user.email ?? undefined,
    ipAddress: request.ip,
    userAgent: typeof userAgent === 'string' ? userAgent : undefined,
  };
}

/** Actor context for unauthenticated / guest public lookup reads. */
export function extractPublicAuditRequestContext(
  request: Request,
): AuditContext {
  const userAgent = request.headers['user-agent'];

  return {
    userEmail: 'SYSTEM_PUBLIC',
    ipAddress: request.ip,
    userAgent: typeof userAgent === 'string' ? userAgent : undefined,
  };
}

export const SYSTEM_SCHEDULER_AUDIT_CONTEXT: AuditContext = {
  userEmail: 'SYSTEM_SCHEDULER',
};
