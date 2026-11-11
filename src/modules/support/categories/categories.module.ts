import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../core/database/prisma.module';
import { TicketCategoriesController } from './controllers/ticket-categories.controller';
import { TicketCategoriesService } from './services/ticket-categories.service';

@Module({
  imports: [PrismaModule],
  controllers: [TicketCategoriesController],
  providers: [TicketCategoriesService],
  exports: [TicketCategoriesService],
})
export class CategoriesModule {}
