import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../core/database/prisma.module';
import { LoanTypesController } from './controllers/loan-types.controller';
import { LoanTypesService } from './services/loan-types.service';

@Module({
  imports: [PrismaModule],
  controllers: [LoanTypesController],
  providers: [LoanTypesService],
  exports: [LoanTypesService],
})
export class LoanTypesModule {}
