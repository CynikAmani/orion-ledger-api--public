import { Module } from '@nestjs/common';
import { CustomerFavoritesModule } from '../../customers/favorites/customer-favorites.module';
import { IncludeDemoTenantsSettingsModule } from '../../system-configurations/platform/include-demo-tenants/include-demo-tenants-settings.module';
import { SharedTenantsModule } from '../shared/shared-tenants.module';
import { PublicTenantsController } from './controllers/public-tenants.controller';
import { PublicTenantsService } from './services/public-tenants.service';

@Module({
  imports: [
    SharedTenantsModule,
    CustomerFavoritesModule,
    IncludeDemoTenantsSettingsModule,
  ],
  controllers: [PublicTenantsController],
  providers: [PublicTenantsService],
  exports: [PublicTenantsService],
})
export class PublicTenantsModule {}
