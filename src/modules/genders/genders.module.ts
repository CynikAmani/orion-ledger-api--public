import { Module } from '@nestjs/common';
import { PrismaModule } from '../../core/database/prisma.module';
import { GendersService } from './services/genders.service';

@Module({
  imports: [PrismaModule],
  providers: [GendersService],
  exports: [GendersService],
})
export class GendersModule {}
