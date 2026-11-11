import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../../core/database/prisma.module';
import { NotificationConfigsController } from './controllers/notification-configs.controller';
import { NotificationConfigsService } from './services/notification-configs.service';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationConfigsController],
  providers: [NotificationConfigsService],
  exports: [NotificationConfigsService],
})
export class NotificationConfigsModule {}
