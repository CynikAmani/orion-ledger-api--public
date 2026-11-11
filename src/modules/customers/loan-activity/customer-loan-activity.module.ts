import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../core/database/prisma.module';
import { CustomerLoanActivityService } from './services/customer-loan-activity.service';

@Module({
  imports: [PrismaModule],
  providers: [CustomerLoanActivityService],
  exports: [CustomerLoanActivityService],
})
export class CustomerLoanActivityModule {}
