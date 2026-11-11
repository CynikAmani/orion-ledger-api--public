import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../core/database/prisma.module';
import { AnnouncementsController } from './controllers/announcements.controller';
import { UserAnnouncementsController } from './controllers/user-announcements.controller';
import { AnnouncementsService } from './services/announcements.service';

@Module({
  imports: [PrismaModule],
  controllers: [UserAnnouncementsController, AnnouncementsController],
  providers: [AnnouncementsService],
  exports: [AnnouncementsService],
})
export class AnnouncementsModule {}
