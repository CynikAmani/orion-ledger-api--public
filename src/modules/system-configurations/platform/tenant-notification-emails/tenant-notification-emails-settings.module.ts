import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../../core/database/prisma.module';
import { TenantNotificationEmailsSettingsController } from './controllers/tenant-notification-emails-settings.controller';
import { TenantNotificationEmailsSettingsService } from './services/tenant-notification-emails-settings.service';

@Module({
  imports: [PrismaModule],
  controllers: [TenantNotificationEmailsSettingsController],
  providers: [TenantNotificationEmailsSettingsService],
  exports: [TenantNotificationEmailsSettingsService],
})
export class TenantNotificationEmailsSettingsModule {}
