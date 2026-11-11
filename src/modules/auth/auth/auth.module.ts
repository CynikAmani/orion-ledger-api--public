import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from '../../../core/database/prisma.module';
import { UserValidationModule } from '../../users/shared/user-validation.module';
import { SubscriptionsModule } from '../../subscriptions/subscriptions.module';
import { OnlineRepaymentsModule } from '../../system-configurations/platform/online-repayments/online-repayments.module';
import { TicketsModule } from '../../support/tickets/tickets.module';
import { SharedTenantsModule } from '../../tenants/shared/shared-tenants.module';
import { MfaModule } from '../mfa/mfa.module';
import { SharedAuthModule } from '../shared/shared-auth.module';
import { AuthController } from './controller/auth.controller';
import { AuthPayloadService } from './services/auth-payload.service';
import { AuthService } from './services/auth.service';
import { GoogleAuthService } from './services/google-auth.service';

@Module({
  imports: [
    PrismaModule,
    UserValidationModule,
    SharedAuthModule,
    SharedTenantsModule,
    SubscriptionsModule,
    OnlineRepaymentsModule,
    TicketsModule,
    forwardRef(() => MfaModule),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthPayloadService, GoogleAuthService],
  exports: [AuthService, AuthPayloadService, GoogleAuthService],
})
export class AuthSessionModule {}
