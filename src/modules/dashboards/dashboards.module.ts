import { Module } from '@nestjs/common';
import { CustomerDashboardModule } from './customer/customer-dashboard.module';
import { PlatformDashboardModule } from './platform/platform-dashboard.module';
import { StaffDashboardModule } from './staff/staff-dashboard.module';

@Module({
  imports: [
    StaffDashboardModule,
    CustomerDashboardModule,
    PlatformDashboardModule,
  ],
  exports: [
    StaffDashboardModule,
    CustomerDashboardModule,
    PlatformDashboardModule,
  ],
})
export class DashboardsModule {}
