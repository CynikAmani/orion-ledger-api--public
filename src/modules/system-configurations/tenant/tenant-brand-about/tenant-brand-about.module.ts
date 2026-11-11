import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../../core/database/prisma.module';
import { TenantBrandAboutController } from './controllers/tenant-brand-about.controller';
import { TenantBrandAboutService } from './services/tenant-brand-about.service';

@Module({
  imports: [PrismaModule],
  controllers: [TenantBrandAboutController],
  providers: [TenantBrandAboutService],
  exports: [TenantBrandAboutService],
})
export class TenantBrandAboutModule {}
