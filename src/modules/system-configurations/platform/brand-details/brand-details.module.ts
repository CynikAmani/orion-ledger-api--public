import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../../core/database/prisma.module';
import { BrandDetailsController } from './controllers/brand-details.controller';
import { BrandDetailsService } from './services/brand-details.service';
import { BrandLogoService } from './services/brand-logo.service';

@Module({
  imports: [PrismaModule],
  controllers: [BrandDetailsController],
  providers: [BrandDetailsService, BrandLogoService],
  exports: [BrandDetailsService],
})
export class BrandDetailsModule {}
