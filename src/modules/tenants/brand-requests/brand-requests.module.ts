import { Module } from '@nestjs/common';
import { AuditModule } from '../../../core/audit/audit.module';
import { PrismaModule } from '../../../core/database/prisma.module';
import { SharedTenantsModule } from '../shared/shared-tenants.module';
import { BrandRequestsController } from './controllers/brand-requests.controller';
import { PlatformBrandRequestsController } from './controllers/platform-brand-requests.controller';
import { BrandOnboardingRequestsService } from './services/brand-onboarding-requests.service';

@Module({
  imports: [PrismaModule, AuditModule, SharedTenantsModule],
  controllers: [BrandRequestsController, PlatformBrandRequestsController],
  providers: [BrandOnboardingRequestsService],
})
export class BrandRequestsModule {}
