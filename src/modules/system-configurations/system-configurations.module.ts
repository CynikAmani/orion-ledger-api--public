import { Module } from '@nestjs/common';
import { BrandAboutModule } from './platform/brand-about/brand-about.module';
import { BrandDetailsModule } from './platform/brand-details/brand-details.module';
import { IncludeDemoTenantsSettingsModule } from './platform/include-demo-tenants/include-demo-tenants-settings.module';
import { MfaSettingsModule } from './platform/mfa-settings/mfa-settings.module';
import { NotificationConfigsModule } from './platform/notification-configs/notification-configs.module';
import { OnlineRepaymentsModule } from './platform/online-repayments/online-repayments.module';
import { TenantConfigAuditModule } from './platform/tenant-config-audit/tenant-config-audit.module';
import { TenantNotificationEmailsSettingsModule } from './platform/tenant-notification-emails/tenant-notification-emails-settings.module';
import { TermsAndConditionsModule } from './platform/terms-and-conditions/terms-and-conditions.module';
import { TenantBrandAboutModule } from './tenant/tenant-brand-about/tenant-brand-about.module';
import { TenantBrandDetailsModule } from './tenant/tenant-brand-details/tenant-brand-details.module';
import { TenantNotificationConfigsModule } from './tenant/tenant-notification-configs';
import { TenantPublicProfileModule } from './tenant/tenant-public-profile/tenant-public-profile.module';
import { TenantTermsAndConditionsModule } from './tenant/tenant-terms-and-conditions/tenant-terms-and-conditions.module';

@Module({
  imports: [
    BrandAboutModule,
    BrandDetailsModule,
    IncludeDemoTenantsSettingsModule,
    MfaSettingsModule,
    OnlineRepaymentsModule,
    NotificationConfigsModule,
    TenantNotificationEmailsSettingsModule,
    TermsAndConditionsModule,
    TenantConfigAuditModule,
    TenantBrandDetailsModule,
    TenantBrandAboutModule,
    TenantNotificationConfigsModule,
    TenantTermsAndConditionsModule,
    TenantPublicProfileModule,
  ],
})
export class SystemConfigurationsModule {}


