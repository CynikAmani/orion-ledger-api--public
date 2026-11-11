import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../core/database/prisma.module';
import { SharedTenantsModule } from '../../tenants/shared/shared-tenants.module';
import { InterestRatesController } from './controllers/interest-rates.controller';
import { InterestRatesService } from './services/interest-rates.service';

@Module({
  imports: [PrismaModule, SharedTenantsModule],
  controllers: [InterestRatesController],
  providers: [InterestRatesService],
  exports: [InterestRatesService],
})
export class InterestRatesModule {}
