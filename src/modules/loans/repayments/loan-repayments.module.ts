import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from '../../../core/database/prisma.module';
import { SharedTenantsModule } from '../../tenants/shared/shared-tenants.module';
import { LoanRecordsCoreModule } from '../records/loan-records-core.module';
import { RepaymentsController } from './controllers/repayments.controller';
import { RepaymentsService } from './services/repayments.service';

@Module({
  imports: [
    PrismaModule,
    SharedTenantsModule,
    forwardRef(() => LoanRecordsCoreModule),
  ],
  controllers: [RepaymentsController],
  providers: [RepaymentsService],
  exports: [RepaymentsService],
})
export class LoanRepaymentsModule {}
