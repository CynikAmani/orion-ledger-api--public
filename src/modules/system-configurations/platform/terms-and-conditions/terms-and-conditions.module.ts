import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../../core/database/prisma.module';
import { TermsAndConditionsController } from './controllers/terms-and-conditions.controller';
import { UserAgreementsController } from './controllers/user-agreements.controller';
import { TermsAndConditionsService } from './services/terms-and-conditions.service';

@Module({
  imports: [PrismaModule],
  controllers: [UserAgreementsController, TermsAndConditionsController],
  providers: [TermsAndConditionsService],
  exports: [TermsAndConditionsService],
})
export class TermsAndConditionsModule {}
