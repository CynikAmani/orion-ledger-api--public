import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../core/database/prisma.module';
import { SharedTenantsModule } from '../../tenants/shared/shared-tenants.module';
import { CategoriesModule } from '../categories/categories.module';
import { CustomerSupportController } from './controllers/customer-support.controller';
import { PlatformSupportController } from './controllers/platform-support.controller';
import { SupportTicketAttachmentsController } from './controllers/support-ticket-attachments.controller';
import { TenantSupportController } from './controllers/tenant-support.controller';
import { SupportInboxSignalService } from './services/support-inbox-signal.service';
import { TicketsService } from './services/tickets.service';

@Module({
  imports: [PrismaModule, CategoriesModule, SharedTenantsModule],
  controllers: [
    CustomerSupportController,
    TenantSupportController,
    PlatformSupportController,
    SupportTicketAttachmentsController,
  ],
  providers: [TicketsService, SupportInboxSignalService],
  exports: [TicketsService, SupportInboxSignalService],
})
export class TicketsModule {}
