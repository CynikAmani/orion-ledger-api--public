import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../core/database/prisma.module';
import { PromotionsController } from './controllers/promotions.controller';
import { PromotionsService } from './services/promotions.service';
import { PromotionsLifecycleTask } from './tasks/promotions-lifecycle.task';

@Module({
  imports: [PrismaModule],
  controllers: [PromotionsController],
  providers: [PromotionsService, PromotionsLifecycleTask],
  exports: [PromotionsService],
})
export class PromotionsModule {}
