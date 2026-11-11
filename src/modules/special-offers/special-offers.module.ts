import { Module } from '@nestjs/common';
import { PrismaModule } from '../../core/database/prisma.module';
import { SharedTenantsModule } from '../tenants/shared/shared-tenants.module';
import { SpecialOffersController } from './controllers/special-offers.controller';
import { RewardEngineService } from './services/reward-engine.service';
import { SpecialOffersService } from './services/special-offers.service';

@Module({
  imports: [PrismaModule, SharedTenantsModule],
  controllers: [SpecialOffersController],
  providers: [SpecialOffersService, RewardEngineService],
  exports: [SpecialOffersService, RewardEngineService],
})
export class SpecialOffersModule {}
