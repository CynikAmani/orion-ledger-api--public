import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../../core/database/prisma.module';
import { IncludeDemoTenantsSettingsController } from './controllers/include-demo-tenants-settings.controller';
import { IncludeDemoTenantsSettingsService } from './services/include-demo-tenants-settings.service';

@Module({
  imports: [PrismaModule],
  controllers: [IncludeDemoTenantsSettingsController],
  providers: [IncludeDemoTenantsSettingsService],
  exports: [IncludeDemoTenantsSettingsService],
})
export class IncludeDemoTenantsSettingsModule {}
