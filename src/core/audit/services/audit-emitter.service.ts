import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AUDIT_LOG_EVENT } from '../constants/audit-events.constant';
import type { AuditPayload } from '../interfaces/audit-payload.interface';
import { normalizeAuditPayload } from '../utils/normalize-audit-payload.util';

@Injectable()
export class AuditEmitterService {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  emit(payload: AuditPayload): void {
    this.eventEmitter.emit(AUDIT_LOG_EVENT, {
      ...payload,
      payload: normalizeAuditPayload(payload.payload, payload.action),
    });
  }

  /**
   * Writes the primary row and a related-entity row that parent drawers can
   * query (e.g. Repayment + Loan). The related row keeps the same actor and
   * points back via relatedTargetType/relatedTargetId instead of cloning.
   */
  emitRelated(
    primary: AuditPayload,
    related: Pick<
      AuditPayload,
      'module' | 'action' | 'targetType' | 'targetId'
    > & {
      tenantId?: string | null;
      payload?: Record<string, unknown>;
    },
  ): void {
    this.emit(primary);
    this.emit({
      userId: primary.userId,
      userEmail: primary.userEmail,
      ipAddress: primary.ipAddress,
      userAgent: primary.userAgent,
      tenantId: related.tenantId ?? primary.tenantId,
      module: related.module,
      action: related.action,
      targetType: related.targetType,
      targetId: related.targetId,
      payload: {
        relatedTargetType: primary.targetType ?? null,
        relatedTargetId: primary.targetId ?? null,
        ...related.payload,
      },
    });
  }
}
