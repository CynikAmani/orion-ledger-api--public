import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  type RawBodyRequest,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../../../auth/shared/decorators/public.decorator';
import { PaychanguWebhookService } from '../services/paychangu-webhook.service';

@ApiTags('Online payments')
@SkipThrottle()
@Controller('payments/webhooks')
export class PaychanguWebhookController {
  constructor(
    private readonly paychanguWebhookService: PaychanguWebhookService,
  ) {}

  @Public()
  @Post('paychangu')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  @ApiOperation({
    summary: 'PayChangu webhook receiver (test and live, mode-agnostic)',
  })
  handlePaychanguWebhook(
    @Req() request: RawBodyRequest<Request>,
  ): Promise<{ received: true }> {
    return this.paychanguWebhookService.handleRawWebhook(
      request.rawBody,
      request.headers.signature,
    );
  }
}
