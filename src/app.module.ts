import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { envValidationSchema } from './core/config';
import { CoreModule } from './core/core.module';
import { PrismaModule } from './core/database/prisma.module';
import {
  AUTH_THROTTLE,
  buildAuthThrottleTracker,
  shouldSkipAuthThrottle,
} from './core/throttling/auth-throttle.util';
import { AuthModule } from './modules/auth/auth.module';
import { ApprovalsModule } from './modules/approvals/approvals.module';
import { AuditLogsModule } from './modules/audit/audit.module';
import { ContentManagementModule } from './modules/content-management/content-management.module';
import { CustomersModule } from './modules/customers/customers.module';
import { DashboardsModule } from './modules/dashboards/dashboards.module';
import { DistrictsModule } from './modules/districts/districts.module';
import { GendersModule } from './modules/genders/genders.module';
import { LoanConfigurationsModule } from './modules/loan-configurations/loan-configurations.module';
import { LoansModule } from './modules/loans/loans.module';
import { LookupsModule } from './modules/lookups/lookups.module';
import { OnlinePaymentsModule } from './modules/online-payments/online-payments.module';
import { RepaymentDetailsModule } from './modules/repayment-details/repayment-details.module';
import { RolesModule } from './modules/roles/roles.module';
import { SandboxModule } from './modules/sandbox/sandbox.module';
import { SpecialOffersModule } from './modules/special-offers/special-offers.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { SupportModule } from './modules/support/support.module';
import { SystemConfigurationsModule } from './modules/system-configurations/system-configurations.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: false,
        allowUnknown: true,
      },
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'default',
          ttl: 60000,
          limit: 30,
        },
        {
          name: AUTH_THROTTLE.name,
          ttl: AUTH_THROTTLE.ttl,
          limit: AUTH_THROTTLE.limit,
          skipIf: shouldSkipAuthThrottle,
          getTracker: (req) => buildAuthThrottleTracker(req),
        },
      ],
    }),
    PrismaModule,
    CoreModule,
    AuthModule,
    ApprovalsModule,
    AuditLogsModule,
    ContentManagementModule,
    CustomersModule,
    DashboardsModule,
    DistrictsModule,
    GendersModule,
    LoanConfigurationsModule,
    LoansModule,
    LookupsModule,
    OnlinePaymentsModule,
    RepaymentDetailsModule,
    RolesModule,
    SandboxModule,
    SpecialOffersModule,
    SubscriptionsModule,
    SupportModule,
    SystemConfigurationsModule,
    TenantsModule,
    UsersModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
