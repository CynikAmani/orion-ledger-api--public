import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../core/database/prisma.module';
import { SharedTenantsModule } from '../../tenants/shared/shared-tenants.module';
import { LoanApplicationSettingsController } from './controllers/loan-application-settings.controller';
import { LoanApplicationSettingsService } from './services/loan-application-settings.service';

@Module({
  imports: [PrismaModule, SharedTenantsModule],
  controllers: [LoanApplicationSettingsController],
  providers: [LoanApplicationSettingsService],
  exports: [LoanApplicationSettingsService],
})
export class LoanApplicationSettingsModule {}
