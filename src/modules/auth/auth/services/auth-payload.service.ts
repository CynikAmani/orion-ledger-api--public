import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../../core/database/prisma.service';
import { OnlineRepaymentsService } from '../../../system-configurations/platform/online-repayments/services/online-repayments.service';
import { TenantSubscriptionsService } from '../../../subscriptions/services/tenant-subscriptions.service';
import { SupportInboxSignalService } from '../../../support/tickets/services/support-inbox-signal.service';
import { TenantLoanApplicationEligibilityService } from '../../../tenants/shared/services/tenant-loan-application-eligibility.service';
import { resolveTenantLogoUrl } from '../../../tenants/shared/utils/resolve-tenant-logo-url.util';
import {
  extractPermissionNames,
  extractRoleKeys,
  userRolesWithPermissionsInclude,
} from '../../shared/utils/user-authorization.util';
import type {
  LoginResponse,
  LoginTenantTheme,
  TokenPair,
} from './auth.service';

const LOGIN_TENANT_THEME_SELECT = {
  tenantId: true,
  slug: true,
  brandColor: true,
  name: true,
  logoUrl: true,
  brandProfile: {
    select: {
      brandName: true,
      logoImgName: true,
    },
  },
} as const;

@Injectable()
export class AuthPayloadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eligibility: TenantLoanApplicationEligibilityService,
    private readonly subscriptions: TenantSubscriptionsService,
    private readonly supportInbox: SupportInboxSignalService,
    private readonly onlineRepayments: OnlineRepaymentsService,
  ) {}

  async buildLoginResponse(
    id: number,
    tokens?: TokenPair,
  ): Promise<LoginResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        ...userRolesWithPermissionsInclude,
        tenant: { select: LOGIN_TENANT_THEME_SELECT },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isNewUser =
      !user.nationalId || user.nationalId === 'OAUTH-PENDING' || !user.phone;

    const hasPassword = !!user.password;
    const permissions = extractPermissionNames(user);
    const [onlineRepaymentsEnabled, support, tenant] = await Promise.all([
      this.onlineRepayments.isOnlineRepaymentsEnabled(),
      this.supportInbox.forLogin({
        userId: user.id,
        tenantId: user.tenant?.tenantId ?? null,
        permissions,
      }),
      this.toLoginTenantTheme(user.tenant),
    ]);

    return {
      accessToken: tokens?.accessToken ?? '',
      refreshToken: tokens?.refreshToken ?? '',
      user: {
        userId: user.userId,
        fullname: user.fullname,
        email: user.email,
        phone: user.phone,
        nationalId: user.nationalId,
        genderId: user.genderId,
        districtId: user.districtId,
        isBlocked: user.isBlocked,
        isNewUser,
        hasPassword,
        roles: extractRoleKeys(user),
        permissions,
        onlineRepaymentsEnabled,
        support,
        tenant,
      },
    };
  }

  private async toLoginTenantTheme(
    tenant: {
      tenantId: string;
      slug: string;
      brandColor: string | null;
      name: string;
      logoUrl: string | null;
      brandProfile: {
        brandName: string | null;
        logoImgName: string | null;
      } | null;
    } | null,
  ): Promise<LoginTenantTheme | null> {
    if (!tenant) {
      return null;
    }

    const logoImgName = tenant.brandProfile?.logoImgName ?? null;
    const [loanApplicationEligibility, subscription] = await Promise.all([
      this.eligibility.getForRead(tenant.tenantId),
      this.subscriptions.access(tenant.tenantId),
    ]);

    return {
      tenantId: tenant.tenantId,
      slug: tenant.slug,
      brandColor: tenant.brandColor,
      brandName: tenant.brandProfile?.brandName ?? tenant.name,
      logoImgName,
      logoUrl: resolveTenantLogoUrl({
        logoUrl: tenant.logoUrl,
        logoImgName,
      }),
      loanApplicationEligibility,
      subscription,
    };
  }
}
