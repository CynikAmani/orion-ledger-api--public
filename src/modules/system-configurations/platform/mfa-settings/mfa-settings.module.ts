import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../../core/database/prisma.module';
import { MfaSettingsController } from './controllers/mfa-settings.controller';
import { MfaSettingsService } from './services/mfa-settings.service';

@Module({
  imports: [PrismaModule],
  controllers: [MfaSettingsController],
  providers: [MfaSettingsService],
  exports: [MfaSettingsService],
})
export class MfaSettingsModule {}
