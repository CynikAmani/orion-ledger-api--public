import { Global, Module } from '@nestjs/common';
import { RequestOriginService } from './request-origin.service';

@Global()
@Module({
  providers: [RequestOriginService],
  exports: [RequestOriginService],
})
export class RequestOriginModule {}
