import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../core/database/prisma.module';
import { PlatformDashboardController } from './controllers/platform-dashboard.controller';
import { PlatformDashboardService } from './services/platform-dashboard.service';

@Module({
  imports: [PrismaModule],
  controllers: [PlatformDashboardController],
  providers: [PlatformDashboardService],
  exports: [PlatformDashboardService],
})
export class PlatformDashboardModule {}
