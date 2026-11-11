import { Module } from '@nestjs/common';
import { SharedUsersModule } from '../../users/shared/shared-users.module';
import { CustomerIdentityDocumentsService } from './services/customer-identity-documents.service';

@Module({
  imports: [SharedUsersModule],
  providers: [CustomerIdentityDocumentsService],
  exports: [CustomerIdentityDocumentsService],
})
export class CustomerIdentityDocumentsModule {}
