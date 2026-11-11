import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../../core/database/prisma.module';
import { SharedTenantsModule } from '../../../tenants/shared/shared-tenants.module';
import { TenantTermsAndConditionsController } from './controllers/tenant-terms-and-conditions.controller';
import { TenantUserAgreementsController } from './controllers/tenant-user-agreements.controller';
import { TenantTermsAndConditionsService } from './services/tenant-terms-and-conditions.service';

@Module({
  imports: [PrismaModule, SharedTenantsModule],
  controllers: [
    TenantUserAgreementsController,
    TenantTermsAndConditionsController,
  ],
  providers: [TenantTermsAndConditionsService],
  exports: [TenantTermsAndConditionsService],
})
export class TenantTermsAndConditionsModule {}
