import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../../core/database/prisma.module';
import { TenantTermsAndConditionsModule } from '../tenant-terms-and-conditions/tenant-terms-and-conditions.module';
import { PublicTenantProfileController } from './controllers/public-tenant-profile.controller';
import { PublicTenantProfileService } from './services/public-tenant-profile.service';

@Module({
  imports: [PrismaModule, TenantTermsAndConditionsModule],
  controllers: [PublicTenantProfileController],
  providers: [PublicTenantProfileService],
})
export class TenantPublicProfileModule {}
