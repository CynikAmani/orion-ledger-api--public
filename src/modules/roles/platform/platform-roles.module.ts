import { Module } from '@nestjs/common';
import { SharedRolesModule } from '../shared/shared-roles.module';
import { PlatformRolesController } from './controllers/platform-roles.controller';
import { PlatformRolesService } from './services/platform-roles.service';

@Module({
  imports: [SharedRolesModule],
  controllers: [PlatformRolesController],
  providers: [PlatformRolesService],
})
export class PlatformRolesModule {}
