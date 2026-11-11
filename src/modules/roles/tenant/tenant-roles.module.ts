import { Module } from '@nestjs/common';
import { SharedRolesModule } from '../shared/shared-roles.module';
import { TenantRolesController } from './controllers/tenant-roles.controller';
import { TenantRolesService } from './services/tenant-roles.service';

@Module({
  imports: [SharedRolesModule],
  controllers: [TenantRolesController],
  providers: [TenantRolesService],
})
export class TenantRolesModule {}
