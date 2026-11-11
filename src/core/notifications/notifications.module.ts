import { Global, Module } from '@nestjs/common';
import { TenantNotificationEmailsSettingsModule } from '../../modules/system-configurations/platform/tenant-notification-emails/tenant-notification-emails-settings.module';
import { PrismaModule } from '../database/prisma.module';
import { NotificationsController } from './controllers/notifications.controller';
import { NotificationDispatcherService } from './services/notification-dispatcher.service';
import { NotificationsService } from './services/notifications.service';

@Global()
@Module({
  imports: [PrismaModule, TenantNotificationEmailsSettingsModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationDispatcherService],
  exports: [NotificationsService, NotificationDispatcherService],
})
export class NotificationsModule {}
