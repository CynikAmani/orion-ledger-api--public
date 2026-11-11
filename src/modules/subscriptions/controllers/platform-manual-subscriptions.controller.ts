import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { extractAuditRequestContext } from '../../../core/audit/utils/audit-request-context.util';
import { PERMISSIONS } from '../../auth/shared/constants/permissions.constant';
import { Permission } from '../../auth/shared/decorators/permission.decorator';
import type { AuthenticatedRequest } from '../../auth/shared/guards/permission.guard';
import { ListManualSubscriptionsQueryDto } from '../dto/list-manual-subscriptions-query.dto';
import { PreviewManualSubscriptionQueryDto } from '../dto/preview-manual-subscription-query.dto';
import { RecordManualSubscriptionDto } from '../dto/record-manual-subscription.dto';
import {
  PlatformManualSubscriptionsService,
  type ManualSubscriptionDetailResponse,
  type ManualSubscriptionPreviewResponse,
  type ManualSubscriptionResponse,
  type PaginatedManualSubscriptionsResponse,
} from '../services/platform-manual-subscriptions.service';
import type { SubscriptionPlanResponse } from '../services/subscription-plans.service';
import { assertPlatformSubscriptionOperator } from '../utils/assert-platform-subscription-operator.util';

@ApiTags('Subscriptions - Platform')
@ApiBearerAuth('bearer')
@Controller('platform/subscriptions')
export class PlatformManualSubscriptionsController {
  constructor(
    private readonly subscriptions: PlatformManualSubscriptionsService,
  ) {}

  @Get('plans')
  @Permission(PERMISSIONS.PLATFORM_SUBSCRIPTIONS.VIEW)
  @ApiOperation({
    summary: 'Active plans for recording a Cash or EFT subscription',
  })
  @ApiResponse({ status: 200, description: 'Active plans' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Platform staff only' })
  plans(
    @Req() request: AuthenticatedRequest,
  ): Promise<SubscriptionPlanResponse[]> {
    assertPlatformSubscriptionOperator(request.user);
    return this.subscriptions.listActivePlans();
  }

  @Get('preview')
  @Permission(PERMISSIONS.PLATFORM_SUBSCRIPTIONS.VIEW)
  @ApiOperation({
    summary: 'Window and amount that a Cash or EFT record would grant',
  })
  @ApiNotFoundResponse({ description: 'Institution or plan not found' })
  preview(
    @Req() request: AuthenticatedRequest,
    @Query() query: PreviewManualSubscriptionQueryDto,
  ): Promise<ManualSubscriptionPreviewResponse> {
    assertPlatformSubscriptionOperator(request.user);
    return this.subscriptions.preview(query.uuid, query.planId);
  }

  @Get()
  @Permission(PERMISSIONS.PLATFORM_SUBSCRIPTIONS.VIEW)
  @ApiOperation({
    summary: 'Cash and EFT subscriptions recorded by platform staff',
  })
  @ApiResponse({ status: 200, description: 'Manual subscription history' })
  history(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListManualSubscriptionsQueryDto,
  ): Promise<PaginatedManualSubscriptionsResponse> {
    assertPlatformSubscriptionOperator(request.user);
    return this.subscriptions.history(query);
  }

  @Post()
  @Permission(PERMISSIONS.PLATFORM_SUBSCRIPTIONS.RECORD)
  @ApiOperation({
    summary: 'Record a Cash or EFT subscription without a payment transaction',
  })
  @ApiResponse({ status: 201, description: 'Subscription recorded' })
  @ApiNotFoundResponse({ description: 'Institution or plan not found' })
  record(
    @Req() request: AuthenticatedRequest,
    @Body() dto: RecordManualSubscriptionDto,
  ): Promise<ManualSubscriptionResponse> {
    assertPlatformSubscriptionOperator(request.user);
    return this.subscriptions.record(
      dto,
      request.user.id,
      extractAuditRequestContext(request),
    );
  }

  @Get(':id')
  @Permission(PERMISSIONS.PLATFORM_SUBSCRIPTIONS.VIEW)
  @ApiOperation({
    summary: 'One Cash or EFT subscription',
  })
  @ApiNotFoundResponse({ description: 'Subscription not found' })
  get(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ManualSubscriptionDetailResponse> {
    assertPlatformSubscriptionOperator(request.user);
    return this.subscriptions.get(id);
  }

  @Delete(':id')
  @Permission(PERMISSIONS.PLATFORM_SUBSCRIPTIONS.RECORD)
  @ApiOperation({
    summary: 'Remove a future Cash or EFT subscription that has not started',
  })
  @ApiConflictResponse({
    description: 'Active, past, or online subscriptions cannot be removed',
  })
  @ApiNotFoundResponse({ description: 'Subscription not found' })
  remove(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ id: string; removed: true }> {
    assertPlatformSubscriptionOperator(request.user);
    return this.subscriptions.remove(id, extractAuditRequestContext(request));
  }
}
