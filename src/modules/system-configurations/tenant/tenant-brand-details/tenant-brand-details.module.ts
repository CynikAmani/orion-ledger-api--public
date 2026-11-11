import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../../core/database/prisma.module';
import { SharedTenantsModule } from '../../../tenants/shared/shared-tenants.module';
import { TenantBrandDetailsController } from './controllers/tenant-brand-details.controller';
import { TenantBrandDetailsService } from './services/tenant-brand-details.service';
import { TenantBrandLogoService } from './services/tenant-brand-logo.service';

@Module({
  imports: [PrismaModule, SharedTenantsModule],
  controllers: [TenantBrandDetailsController],
  providers: [TenantBrandDetailsService, TenantBrandLogoService],
  exports: [TenantBrandDetailsService],
})
export class TenantBrandDetailsModule {}
