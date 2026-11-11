import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../../core/database/prisma.module';
import { OnlineRepaymentsController } from './controllers/online-repayments.controller';
import { OnlineRepaymentsService } from './services/online-repayments.service';

@Module({
  imports: [PrismaModule],
  controllers: [OnlineRepaymentsController],
  providers: [OnlineRepaymentsService],
  exports: [OnlineRepaymentsService],
})
export class OnlineRepaymentsModule {}
