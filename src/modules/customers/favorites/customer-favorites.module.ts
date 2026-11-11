import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../core/database/prisma.module';
import { IncludeDemoTenantsSettingsModule } from '../../system-configurations/platform/include-demo-tenants/include-demo-tenants-settings.module';
import { CustomerFavoritesController } from './controllers/customer-favorites.controller';
import { CustomerFavoritesService } from './services/customer-favorites.service';

@Module({
  imports: [PrismaModule, IncludeDemoTenantsSettingsModule],
  controllers: [CustomerFavoritesController],
  providers: [CustomerFavoritesService],
  exports: [CustomerFavoritesService],
})
export class CustomerFavoritesModule {}

