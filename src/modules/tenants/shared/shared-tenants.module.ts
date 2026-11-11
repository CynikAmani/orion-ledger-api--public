import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../core/database/prisma.module';
import { IncludeDemoTenantsSettingsModule } from '../../system-configurations/platform/include-demo-tenants/include-demo-tenants-settings.module';
import { TenantLoanApplicationEligibilityController } from './controllers/tenant-loan-application-eligibility.controller';
import { TenantBrandNameService } from './services/tenant-brand-name.service';
import { TenantLoanApplicationEligibilityService } from './services/tenant-loan-application-eligibility.service';
import { TenantService } from './services/tenant.service';

@Module({
  imports: [PrismaModule, IncludeDemoTenantsSettingsModule],
  controllers: [TenantLoanApplicationEligibilityController],
  providers: [
    TenantService,
    TenantBrandNameService,
    TenantLoanApplicationEligibilityService,
  ],
  exports: [
    TenantService,
    TenantBrandNameService,
    TenantLoanApplicationEligibilityService,
  ],
})
export class SharedTenantsModule {}

