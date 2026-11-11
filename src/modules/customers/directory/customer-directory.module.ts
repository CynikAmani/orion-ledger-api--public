import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../core/database/prisma.module';
import { CustomersController } from './controllers/customers.controller';
import { CustomerDirectoryService } from './services/customer-directory.service';

@Module({
  imports: [PrismaModule],
  controllers: [CustomersController],
  providers: [CustomerDirectoryService],
  exports: [CustomerDirectoryService],
})
export class CustomerDirectoryModule {}
