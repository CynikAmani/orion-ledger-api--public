import { forwardRef, Module } from '@nestjs/common';
import { SubscriptionsModule } from '../../../subscriptions/subscriptions.module';
import { PAYMENT_PROVIDER_CLIENT } from '../../constants/online-payment.constant';
import { PaychanguWebhookController } from './controllers/paychangu-webhook.controller';
import { PaychanguApiClient } from './services/paychangu-api.client';
import { PaychanguConfigService } from './services/paychangu-config.service';
import { PaychanguWebhookService } from './services/paychangu-webhook.service';

@Module({
  imports: [forwardRef(() => SubscriptionsModule)],
  controllers: [PaychanguWebhookController],
  providers: [
    PaychanguConfigService,
    PaychanguApiClient,
    PaychanguWebhookService,
    {
      provide: PAYMENT_PROVIDER_CLIENT,
      useExisting: PaychanguApiClient,
    },
  ],
  exports: [PAYMENT_PROVIDER_CLIENT],
})
export class PaychanguModule {}
