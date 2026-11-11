import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AUDIT_LOG_EVENT } from '../constants/audit-events.constant';
import type { AuditPayload } from '../interfaces/audit-payload.interface';
import { AuditService } from '../services/audit.service';

@Injectable()
export class AuditListener {
  private readonly logger = new Logger(AuditListener.name);

  constructor(private readonly auditService: AuditService) {}

  @OnEvent(AUDIT_LOG_EVENT, { async: true })
  async handleAuditLog(payload: AuditPayload): Promise<void> {
    try {
      await this.auditService.record(payload);
    } catch (error) {
      this.logger.error(
        'Failed to persist audit log entry',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
