import { Module } from '@nestjs/common';
import { BrandRequestsModule } from './brand-requests/brand-requests.module';
import { PlatformTenantsModule } from './platform/platform-tenants.module';
import { PublicTenantsModule } from './public/public-tenants.module';
import { SharedTenantsModule } from './shared/shared-tenants.module';

@Module({
  imports: [
    SharedTenantsModule,
    PlatformTenantsModule,
    PublicTenantsModule,
    BrandRequestsModule,
  ],
  exports: [SharedTenantsModule, PlatformTenantsModule, PublicTenantsModule],
})
export class TenantsModule {}
