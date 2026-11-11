import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../core/database/prisma.module';
import { BrandShowcasesController } from './controllers/brand-showcases.controller';
import { BrandShowcasesService } from './services/brand-showcases.service';

@Module({
  imports: [PrismaModule],
  controllers: [BrandShowcasesController],
  providers: [BrandShowcasesService],
  exports: [BrandShowcasesService],
})
export class BrandShowcasesModule {}
