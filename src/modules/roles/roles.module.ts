import { Module } from '@nestjs/common';
import { PlatformRolesModule } from './platform/platform-roles.module';
import { SharedRolesModule } from './shared/shared-roles.module';
import { TenantRolesModule } from './tenant/tenant-roles.module';

@Module({
  imports: [SharedRolesModule, PlatformRolesModule, TenantRolesModule],
  exports: [SharedRolesModule, PlatformRolesModule, TenantRolesModule],
})
export class RolesModule {}
