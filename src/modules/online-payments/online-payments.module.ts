import { Module } from '@nestjs/common';
import { PaychanguModule } from './providers/paychangu/paychangu.module';

@Module({
  imports: [PaychanguModule],
  exports: [PaychanguModule],
})
export class OnlinePaymentsModule {}
