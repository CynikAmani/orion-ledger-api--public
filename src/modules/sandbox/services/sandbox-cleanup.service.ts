import { Injectable, Logger } from '@nestjs/common';
import { SYSTEM_SCHEDULER_AUDIT_CONTEXT } from '../../../core/audit/utils/audit-request-context.util';
import { AuditService } from '../../../core/audit/services/audit.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { SANDBOX_AUDIT_ACTIONS } from '../constants/sandbox-audit-actions.constant';

@Injectable()
export class SandboxCleanupService {
  private readonly logger = new Logger(SandboxCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Drops expired visit tokens only. The permanent demo user, the institution,
   * and any records they changed stay in place.
   */
  async revokeExpired(): Promise<void> {
    const revoked = await this.prisma.demoSession.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });

    if (revoked.count === 0) {
      return;
    }

    this.logger.log(`Revoked ${revoked.count} expired sandbox session(s)`);

    await this.auditService.record({
      ...SYSTEM_SCHEDULER_AUDIT_CONTEXT,
      module: 'TENANT',
      action: SANDBOX_AUDIT_ACTIONS.REVOKED,
      targetType: 'DemoSession',
      payload: { revoked: revoked.count },
    });
  }
}
