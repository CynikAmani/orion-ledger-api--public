import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../core/database/prisma.module';
import { UserValidationModule } from '../../users/shared/user-validation.module';
import { PasswordResetController } from './controller/password-reset.controller';
import { PasswordResetService } from './services/password-reset.service';

@Module({
  imports: [PrismaModule, UserValidationModule],
  controllers: [PasswordResetController],
  providers: [PasswordResetService],
})
export class PasswordResetModule {}
