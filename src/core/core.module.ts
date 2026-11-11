import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { GlobalExceptionFilter } from '../common/filters/global-exception.filter';
import { PrismaClientExceptionFilter } from '../common/filters/prisma-client-exception.filter';
import { LoggingInterceptor } from '../common/interceptors/logging.interceptor';
import { AuthModule } from '../modules/auth/auth.module';
import { JwtAuthGuard } from '../modules/auth/shared/guards/jwt-auth.guard';
import { PermissionGuard } from '../modules/auth/shared/guards/permission.guard';
import { SubscriptionGuard } from '../modules/auth/shared/guards/subscription.guard';
import { AuditModule } from './audit/audit.module';
import { RequestOriginModule } from './config/request-origin.module';
import { EmailModule } from './email/email.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './database/prisma.module';
import { ScheduleModule } from './schedule/schedule.module';
import { StorageModule } from './storage/storage.module';

@Global()
@Module({
  imports: [
    EventEmitterModule.forRoot(),
    RequestOriginModule,
    PrismaModule,
    ScheduleModule,
    AuthModule,
    EmailModule,
    AuditModule,
    NotificationsModule,
    StorageModule,
  ],
  exports: [
    EmailModule,
    NotificationsModule,
    ScheduleModule,
    AuditModule,
    StorageModule,
    RequestOriginModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: PrismaClientExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionGuard,
    },
    {
      provide: APP_GUARD,
      useClass: SubscriptionGuard,
    },
  ],
})
export class CoreModule {}
