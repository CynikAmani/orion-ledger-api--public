import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../../core/database/prisma.module';
import { TenantNotificationEmailsSettingsModule } from '../../platform/tenant-notification-emails/tenant-notification-emails-settings.module';
import { TenantNotificationConfigsController } from './controllers/tenant-notification-configs.controller';
import { TenantNotificationConfigsService } from './services/tenant-notification-configs.service';

@Module({
  imports: [PrismaModule, TenantNotificationEmailsSettingsModule],
  controllers: [TenantNotificationConfigsController],
  providers: [TenantNotificationConfigsService],
  exports: [TenantNotificationConfigsService],
})
export class TenantNotificationConfigsModule {}
