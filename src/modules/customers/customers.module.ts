import { Module } from '@nestjs/common';
import { CustomerDirectoryModule } from './directory/customer-directory.module';
import { CustomerFavoritesModule } from './favorites/customer-favorites.module';
import { CustomerIdentityDocumentsModule } from './identity-documents/customer-identity-documents.module';
import { CustomerLoanActivityModule } from './loan-activity/customer-loan-activity.module';

@Module({
  imports: [
    CustomerDirectoryModule,
    CustomerFavoritesModule,
    CustomerIdentityDocumentsModule,
    CustomerLoanActivityModule,
  ],
  exports: [
    CustomerDirectoryModule,
    CustomerFavoritesModule,
    CustomerIdentityDocumentsModule,
    CustomerLoanActivityModule,
  ],
})
export class CustomersModule {}
