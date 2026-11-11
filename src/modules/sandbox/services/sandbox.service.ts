import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { formatDisplayDateTime } from '../../../common/utils/format-date.util';
import { AuditService } from '../../../core/audit/services/audit.service';
import type { AuditContext } from '../../../core/audit/interfaces/audit-payload.interface';
import { PrismaService } from '../../../core/database/prisma.service';
import { PLATFORM_NOTIFICATION_ACTIONS } from '../../../core/notifications/constants/notification-action-keys.constant';
import { NotificationDispatcherService } from '../../../core/notifications/services/notification-dispatcher.service';
import { AuthPayloadService } from '../../auth/auth/services/auth-payload.service';
import {
  AuthService,
  type LoginResponse,
} from '../../auth/auth/services/auth.service';
import { TENANT_ADMINISTRATOR_ROLE } from '../../tenants/platform/constants/tenant-onboarding.constant';
import { SANDBOX_AUDIT_ACTIONS } from '../constants/sandbox-audit-actions.constant';
import {
  SANDBOX_UNAVAILABLE_MESSAGE,
  SANDBOX_USER_FULLNAME,
  SANDBOX_USER_ID_PREFIX,
  SANDBOX_USER_PHONE,
} from '../constants/sandbox.constant';
import { sandboxSessionExpiresAt } from '../utils/sandbox-session-ttl.util';
import { selectDemoTenant } from '../utils/select-demo-tenant.util';

export interface SandboxSessionResponse extends LoginResponse {
  /** When this visit ends. Refresh after this uses the normal expired-session path. */
  expiresAt: string;
}

interface DemoInstitution {
  tenantId: string;
  name: string;
  slug: string;
}

interface DemoAccount {
  id: number;
  userId: string;
}

@Injectable()
export class SandboxService {
  private readonly logger = new Logger(SandboxService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly authPayloadService: AuthPayloadService,
    private readonly auditService: AuditService,
    private readonly notificationDispatcher: NotificationDispatcherService,
  ) {}

  async start(auditContext: AuditContext): Promise<SandboxSessionResponse> {
    const tenant = await this.selectOpenDemoTenant();
    const administratorRoleId = await this.findAdministratorRoleId(
      tenant.tenantId,
    );
    const user = await this.resolveDemoUser(
      tenant.tenantId,
      administratorRoleId,
    );
    const expiresAt = sandboxSessionExpiresAt();
    const issued = await this.authService.issueSandboxSession(
      user.id,
      expiresAt,
    );

    const session = await this.prisma.demoSession.create({
      data: {
        userId: user.id,
        tenantId: tenant.tenantId,
        refreshTokenHash: issued.refreshTokenHash,
        expiresAt,
        lastActivityAt: new Date(),
      },
      select: { id: true },
    });

    const login = await this.authPayloadService.buildLoginResponse(user.id, {
      accessToken: issued.accessToken,
      refreshToken: issued.refreshToken,
    });

    await this.auditService.record({
      ...auditContext,
      userId: user.id,
      userEmail: undefined,
      tenantId: tenant.tenantId,
      module: 'TENANT',
      action: SANDBOX_AUDIT_ACTIONS.STARTED,
      targetId: session.id,
      targetType: 'DemoSession',
      payload: {
        expiresAt: expiresAt.toISOString(),
        demoUserId: user.userId,
      },
    });

    this.notifyVisitStarted(tenant, expiresAt);

    return {
      ...login,
      expiresAt: expiresAt.toISOString(),
    };
  }

  private async selectOpenDemoTenant(): Promise<DemoInstitution> {
    const rows = await this.prisma.tenant.findMany({
      where: {
        isDemo: true,
        isActive: true,
        deletedAt: null,
      },
      select: {
        tenantId: true,
        name: true,
        slug: true,
        createdAt: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        subscriptionAccessEndsAt: true,
        _count: {
          select: {
            loans: true,
            loanApplications: true,
          },
        },
      },
    });

    const selected = selectDemoTenant(
      rows.map((row) => ({
        tenantId: row.tenantId,
        createdAt: row.createdAt,
        subscriptionStatus: row.subscriptionStatus,
        trialEndsAt: row.trialEndsAt,
        subscriptionAccessEndsAt: row.subscriptionAccessEndsAt,
        loanCount: row._count.loans,
        applicationCount: row._count.loanApplications,
      })),
      new Date(),
    );

    const match = rows.find((row) => row.tenantId === selected?.tenantId);

    if (!selected || !match) {
      this.logger.warn('Sandbox start refused: no open demo tenant');
      throw new ServiceUnavailableException(SANDBOX_UNAVAILABLE_MESSAGE);
    }

    return {
      tenantId: match.tenantId,
      name: match.name,
      slug: match.slug,
    };
  }

  private async findAdministratorRoleId(tenantId: string): Promise<number> {
    const role = await this.prisma.role.findUnique({
      where: {
        tenantId_key: {
          tenantId,
          key: TENANT_ADMINISTRATOR_ROLE.key,
        },
      },
      select: { roleId: true },
    });

    if (!role) {
      this.logger.error(
        `Sandbox start refused: tenant ${tenantId} has no Administrator role`,
      );
      throw new ServiceUnavailableException(SANDBOX_UNAVAILABLE_MESSAGE);
    }

    return role.roleId;
  }

  private async resolveDemoUser(
    tenantId: string,
    administratorRoleId: number,
  ): Promise<DemoAccount> {
    const existing = await this.findActiveDemoUser(
      tenantId,
      administratorRoleId,
    );
    if (existing) {
      return existing;
    }

    try {
      return await this.createDemoUser(tenantId, administratorRoleId);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const raced = await this.findActiveDemoUser(
          tenantId,
          administratorRoleId,
        );
        if (raced) {
          return raced;
        }
      }

      throw error;
    }
  }

  private async findActiveDemoUser(
    tenantId: string,
    administratorRoleId: number,
  ): Promise<DemoAccount | null> {
    const mapped = await this.prisma.demoUser.findUnique({
      where: { tenantId },
      select: { userId: true },
    });

    if (!mapped) {
      return null;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: mapped.userId },
      select: { id: true, userId: true, deletedAt: true, tenantId: true },
    });

    if (!user || user.tenantId !== tenantId) {
      return null;
    }

    if (user.deletedAt !== null) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { deletedAt: null },
      });
    }

    await this.ensureAdministratorRole(user.id, tenantId, administratorRoleId);

    return { id: user.id, userId: user.userId };
  }

  private async ensureAdministratorRole(
    userId: number,
    tenantId: string,
    administratorRoleId: number,
  ): Promise<void> {
    const assignment = await this.prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId,
          roleId: administratorRoleId,
        },
      },
      select: { userId: true },
    });

    if (assignment) {
      return;
    }

    await this.prisma.userRole.create({
      data: {
        userId,
        roleId: administratorRoleId,
        tenantId,
      },
    });
  }

  private async createDemoUser(
    tenantId: string,
    administratorRoleId: number,
  ): Promise<DemoAccount> {
    const handle = `${SANDBOX_USER_ID_PREFIX}${tenantId}`;

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          userId: handle,
          fullname: SANDBOX_USER_FULLNAME,
          nationalId: `SANDBOX-${tenantId}`,
          phone: SANDBOX_USER_PHONE,
          isMfaEnabled: false,
          tenantId,
          userRoles: {
            create: {
              roleId: administratorRoleId,
              tenantId,
            },
          },
        },
        select: { id: true, userId: true },
      });

      await tx.demoUser.create({
        data: {
          tenantId,
          userId: created.id,
        },
      });

      return created;
    });
  }

  private notifyVisitStarted(tenant: DemoInstitution, expiresAt: Date): void {
    void this.notificationDispatcher.dispatch(
      PLATFORM_NOTIFICATION_ACTIONS.SANDBOX.VISIT_STARTED,
      {
        subject: 'Sandbox visit started',
        message: `A visitor started a demo session on ${tenant.name}.`,
        templateData: {
          organization: tenant.name,
          slug: tenant.slug,
          endsAt: formatDisplayDateTime(expiresAt),
        },
      },
    );
  }
}
