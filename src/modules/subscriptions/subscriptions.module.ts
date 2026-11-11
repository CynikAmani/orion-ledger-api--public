import { forwardRef, Module } from '@nestjs/common';
import { OnlinePaymentsModule } from '../online-payments/online-payments.module';
import { ONLINE_PAYMENT_SETTLEMENT } from '../online-payments/settlement/online-payment-settlement';
import { BrandAboutModule } from '../system-configurations/platform/brand-about/brand-about.module';
import { OnlineRepaymentsModule } from '../system-configurations/platform/online-repayments/online-repayments.module';
import { SubscriptionPaymentsController } from './controllers/subscription-payments.controller';
import { PlatformSubscriptionPlansController } from './controllers/platform-subscription-plans.controller';
import { SubscriptionPlanCatalogController } from './controllers/subscription-plan-catalog.controller';
import { TenantSubscriptionsController } from './controllers/tenant-subscriptions.controller';
import { PlatformManualSubscriptionsController } from './controllers/platform-manual-subscriptions.controller';
import { PlatformPaymentTransactionsController } from './controllers/platform-payment-transactions.controller';
import { SubscriptionPaymentInitiationService } from './services/subscription-payment-initiation.service';
import { SubscriptionPaymentSettlementService } from './services/subscription-payment-settlement.service';
import { SubscriptionPaymentVerificationService } from './services/subscription-payment-verification.service';
import { SubscriptionPlanStatsService } from './services/subscription-plan-stats.service';
import { PlanDiscountsService } from './services/plan-discounts.service';
import { SubscriptionPlansService } from './services/subscription-plans.service';
import { TenantSubscriptionsService } from './services/tenant-subscriptions.service';
import { PlatformManualSubscriptionsService } from './services/platform-manual-subscriptions.service';
import { PlatformPaymentTransactionsService } from './services/platform-payment-transactions.service';

@Module({
  imports: [
    forwardRef(() => OnlinePaymentsModule),
    OnlineRepaymentsModule,
    BrandAboutModule,
  ],
  controllers: [
    SubscriptionPaymentsController,
    PlatformSubscriptionPlansController,
    SubscriptionPlanCatalogController,
    TenantSubscriptionsController,
    PlatformManualSubscriptionsController,
    PlatformPaymentTransactionsController,
  ],
  providers: [
    SubscriptionPaymentInitiationService,
    SubscriptionPaymentSettlementService,
    SubscriptionPaymentVerificationService,
    SubscriptionPlansService,
    PlanDiscountsService,
    SubscriptionPlanStatsService,
    TenantSubscriptionsService,
    PlatformManualSubscriptionsService,
    PlatformPaymentTransactionsService,
    {
      provide: ONLINE_PAYMENT_SETTLEMENT,
      useExisting: SubscriptionPaymentSettlementService,
    },
  ],
  exports: [ONLINE_PAYMENT_SETTLEMENT, TenantSubscriptionsService],
})
export class SubscriptionsModule {}
