import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { PERMISSIONS } from '../../auth/shared/constants/permissions.constant';
import { Permission } from '../../auth/shared/decorators/permission.decorator';
import type { AuthenticatedRequest } from '../../auth/shared/guards/permission.guard';
import { ListPlatformPaymentTransactionsQueryDto } from '../dto/list-platform-payment-transactions-query.dto';
import { PaymentTransactionStatsQueryDto } from '../dto/payment-transaction-stats-query.dto';
import {
  PlatformPaymentTransactionsService,
  type PaginatedPlatformPaymentTransactionsResponse,
  type PaymentTransactionStatsResponse,
  type PlatformPaymentTransactionDetailResponse,
} from '../services/platform-payment-transactions.service';
import { assertPlatformPaymentAuditor } from '../utils/assert-platform-payment-auditor.util';

@ApiTags('Payment transactions - Platform')
@ApiBearerAuth('bearer')
@Controller('platform/payment-transactions')
export class PlatformPaymentTransactionsController {
  constructor(
    private readonly transactions: PlatformPaymentTransactionsService,
  ) {}

  @Get('stats')
  @Permission(PERMISSIONS.PLATFORM_PAYMENT_TRANSACTIONS.STATS_VIEW)
  @ApiOperation({
    summary: 'Payment attempt totals for this month, this year, and all time',
  })
  @ApiResponse({ status: 200, description: 'Interval totals' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Platform staff only' })
  stats(
    @Req() request: AuthenticatedRequest,
    @Query() query: PaymentTransactionStatsQueryDto,
  ): Promise<PaymentTransactionStatsResponse> {
    assertPlatformPaymentAuditor(request.user);
    return this.transactions.stats(query);
  }

  @Get()
  @Permission(PERMISSIONS.PLATFORM_PAYMENT_TRANSACTIONS.READ)
  @ApiOperation({
    summary: 'Online payment attempts for platform inspection',
  })
  @ApiResponse({ status: 200, description: 'Paginated payment transactions' })
  list(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListPlatformPaymentTransactionsQueryDto,
  ): Promise<PaginatedPlatformPaymentTransactionsResponse> {
    assertPlatformPaymentAuditor(request.user);
    return this.transactions.list(query);
  }

  @Get(':id')
  @Permission(PERMISSIONS.PLATFORM_PAYMENT_TRANSACTIONS.READ)
  @ApiOperation({
    summary: 'One online payment attempt and its purchase events',
  })
  @ApiNotFoundResponse({ description: 'Payment transaction not found' })
  get(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PlatformPaymentTransactionDetailResponse> {
    assertPlatformPaymentAuditor(request.user);
    return this.transactions.get(id);
  }
}
