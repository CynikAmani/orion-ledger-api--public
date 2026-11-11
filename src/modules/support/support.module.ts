import { Module } from '@nestjs/common';
import { CategoriesModule } from './categories/categories.module';
import { TicketsModule } from './tickets/tickets.module';

@Module({
  imports: [CategoriesModule, TicketsModule],
  exports: [CategoriesModule, TicketsModule],
})
export class SupportModule {}
