import { Module } from '@nestjs/common';
import { PrismaModule } from '../../core/database/prisma.module';
import { DistrictsService } from './services/districts.service';

@Module({
  imports: [PrismaModule],
  providers: [DistrictsService],
  exports: [DistrictsService],
})
export class DistrictsModule {}
