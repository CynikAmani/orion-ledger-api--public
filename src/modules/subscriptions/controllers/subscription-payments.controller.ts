import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RequestOriginService } from '../../../core/config/request-origin.service';
import { extractAuditRequestContext } from '../../../core/audit/utils/audit-request-context.util';
import { PERMISSIONS } from '../../auth/shared/constants/permissions.constant';
import { AllowExpiredSubscription } from '../../auth/shared/decorators/allow-expired-subscription.decorator';
import { Permission } from '../../auth/shared/decorators/permission.decorator';
import type { AuthenticatedRequest } from '../../auth/shared/guards/permission.guard';
import { resolveCallerTenantId } from '../../roles/shared/utils/resolve-caller-tenant.util';
import { InitiateSubscriptionPaymentDto } from '../dto/initiate-subscription-payment.dto';
import {
  SubscriptionPaymentInitiationService,
  type InitiateSubscriptionPaymentResponse,
  type SubscriptionPaymentStatusResponse,
} from '../services/subscription-payment-initiation.service';
import {
  SubscriptionPaymentVerificationService,
  type SubscriptionPaymentVerificationResponse,
} from '../services/subscription-payment-verification.service';

@ApiTags('Subscriptions')
@ApiBearerAuth('bearer')
@AllowExpiredSubscription()
@Controller('subscriptions/payments')
export class SubscriptionPaymentsController {
  constructor(
    private readonly initiation: SubscriptionPaymentInitiationService,
    private readonly verification: SubscriptionPaymentVerificationService,
    private readonly requestOrigin: RequestOriginService,
  ) {}

  @Post()
  @Permission(PERMISSIONS.SUBSCRIPTIONS.PAY)
  @ApiOperation({
    summary:
      'Start PayChangu checkout for an active plan. Optional discountCode redeems a private coupon. The amount charged is the plan price after any applied discount.',
  })
  @ApiResponse({ status: 201, description: 'Checkout started' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or tenant membership required',
  })
  @ApiNotFoundResponse({ description: 'Subscription plan not found' })
  initiate(
    @Req() request: AuthenticatedRequest,
    @Body() dto: InitiateSubscriptionPaymentDto,
  ): Promise<InitiateSubscriptionPaymentResponse> {
    return this.initiation.initiate({
      tenantId: resolveCallerTenantId(request.user),
      initiatedById: request.user.id,
      initiatedByEmail: request.user.email ?? undefined,
      initiatedByFullname: request.user.fullname,
      planId: dto.planId,
      discountCode: dto.discountCode,
      frontendOrigin: this.requestOrigin.resolve(request),
      audit: extractAuditRequestContext(request),
    });
  }

  @Post(':transactionReference/verify')
  @HttpCode(HttpStatus.OK)
  @Permission(PERMISSIONS.SUBSCRIPTIONS.PAYMENTS_VIEW)
  @ApiOperation({
    summary:
      'Report a checkout return and settle it with PayChangu',
    description:
      'The browser pages /app/subscription/checkout/return and /app/subscription/checkout/callback call this once when they load. Read tx_ref from the query string. Ignore the status query param. A PayChangu success, failed, or cancelled status is settled from their verify response. HTTP 400 means PayChangu has no payment for this checkout: the attempt is stored as cancelled. There is no cancel webhook. 503 means PayChangu did not answer. Call once and stop.',
  })
  @ApiResponse({ status: 200, description: 'Payment settlement status' })
  @ApiNotFoundResponse({ description: 'Payment transaction not found' })
  @ApiServiceUnavailableResponse({
    description: 'PayChangu verification is unavailable',
  })
  verify(
    @Req() request: AuthenticatedRequest,
    @Param('transactionReference') transactionReference: string,
  ): Promise<SubscriptionPaymentVerificationResponse> {
    return this.verification.verifyForTenant(
      resolveCallerTenantId(request.user),
      transactionReference,
    );
  }

  @Get(':transactionReference')
  @Permission(PERMISSIONS.SUBSCRIPTIONS.PAYMENTS_VIEW)
  @ApiOperation({
    summary: 'Read a subscription checkout for the caller institution',
  })
  @ApiResponse({ status: 200, description: 'Payment status' })
  @ApiNotFoundResponse({ description: 'Payment transaction not found' })
  getStatus(
    @Req() request: AuthenticatedRequest,
    @Param('transactionReference') transactionReference: string,
  ): Promise<SubscriptionPaymentStatusResponse> {
    return this.initiation.getForTenant(
      resolveCallerTenantId(request.user),
      transactionReference,
    );
  }
}
