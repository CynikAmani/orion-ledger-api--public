import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../core/database/prisma.module';
import { AdvertsController } from './controllers/adverts.controller';
import { AdvertsService } from './services/adverts.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdvertsController],
  providers: [AdvertsService],
  exports: [AdvertsService],
})
export class AdvertsModule {}
