import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../../core/database/prisma.module';
import { BrandAboutController } from './controllers/brand-about.controller';
import { BrandAboutService } from './services/brand-about.service';

@Module({
  imports: [PrismaModule],
  controllers: [BrandAboutController],
  providers: [BrandAboutService],
  exports: [BrandAboutService],
})
export class BrandAboutModule {}
