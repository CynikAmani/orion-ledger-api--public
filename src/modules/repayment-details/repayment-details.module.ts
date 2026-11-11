import { Module } from '@nestjs/common';
import { PrismaModule } from '../../core/database/prisma.module';
import { SharedTenantsModule } from '../tenants/shared/shared-tenants.module';
import { RepaymentDetailsController } from './controllers/repayment-details.controller';
import { RepaymentDetailsService } from './services/repayment-details.service';

@Module({
  imports: [PrismaModule, SharedTenantsModule],
  controllers: [RepaymentDetailsController],
  providers: [RepaymentDetailsService],
  exports: [RepaymentDetailsService],
})
export class RepaymentDetailsModule {}
