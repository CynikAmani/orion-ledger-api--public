import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
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
import { CreatePlanDiscountDto } from '../dto/create-plan-discount.dto';
import { CreateSubscriptionPlanDto } from '../dto/create-subscription-plan.dto';
import { ListSubscriptionPlansQueryDto } from '../dto/list-subscription-plans-query.dto';
import { ListSubscriptionSubscribersQueryDto } from '../dto/list-subscription-subscribers-query.dto';
import { UpdatePlanDiscountDto } from '../dto/update-plan-discount.dto';
import { UpdateSubscriptionPlanDto } from '../dto/update-subscription-plan.dto';
import { UpdateSubscriptionPlanStatusDto } from '../dto/update-subscription-plan-status.dto';
import {
  SubscriptionPlanStatsService,
  type PaginatedSubscriptionSubscribersResponse,
  type SubscriptionCatalogStatsResponse,
  type SubscriptionPlanStatsResponse,
} from '../services/subscription-plan-stats.service';
import { PlanDiscountsService } from '../services/plan-discounts.service';
import {
  SubscriptionPlansService,
  type InitializeSubscriptionPlansResponse,
  type SubscriptionPlanRemovalResponse,
  type SubscriptionPlanResponse,
} from '../services/subscription-plans.service';

@ApiTags('Subscription plans - Platform')
@ApiBearerAuth('bearer')
@Controller('platform/subscription-plans')
export class PlatformSubscriptionPlansController {
  constructor(
    private readonly plans: SubscriptionPlansService,
    private readonly discounts: PlanDiscountsService,
    private readonly stats: SubscriptionPlanStatsService,
  ) {}

  @Post()
  @Permission(PERMISSIONS.PLATFORM_SUBSCRIPTION_PLANS.CREATE)
  @ApiOperation({ summary: 'Add a subscription plan to the catalog' })
  @ApiResponse({ status: 201, description: 'Plan created' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateSubscriptionPlanDto,
  ): Promise<SubscriptionPlanResponse> {
    return this.plans.create(dto, extractAuditRequestContext(request));
  }

  @Get()
  @Permission(PERMISSIONS.PLATFORM_SUBSCRIPTION_PLANS.READ)
  @ApiOperation({
    summary: 'List catalog plans',
    description: 'Filter with status=all, active, or deactivated.',
  })
  @ApiResponse({ status: 200, description: 'Plan catalog' })
  list(
    @Query() query: ListSubscriptionPlansQueryDto,
  ): Promise<SubscriptionPlanResponse[]> {
    return this.plans.list(query.status);
  }

  @Get('stats')
  @Permission(PERMISSIONS.PLATFORM_SUBSCRIPTION_PLANS.STATS_VIEW)
  @ApiOperation({
    summary: 'Catalog performance',
    description:
      'Most popular and worst performing plans are ranked by transactions initiated, then successful charges, active subscribers, and collected revenue.',
  })
  @ApiResponse({ status: 200, description: 'Subscription catalog stats' })
  statsOverview(): Promise<SubscriptionCatalogStatsResponse> {
    return this.stats.catalogStats();
  }

  @Post('initialize')
  @HttpCode(HttpStatus.OK)
  @Permission(PERMISSIONS.PLATFORM_SUBSCRIPTION_PLANS.CREATE)
  @ApiOperation({
    summary:
      'Seed Monthly, Semi-Annual, and Annual plans when the catalog is empty',
  })
  @ApiResponse({
    status: 200,
    description: 'Plans created or catalog already present',
  })
  initialize(
    @Req() request: AuthenticatedRequest,
  ): Promise<InitializeSubscriptionPlansResponse> {
    return this.plans.initialize(extractAuditRequestContext(request));
  }

  @Get('subscribers')
  @Permission(PERMISSIONS.PLATFORM_SUBSCRIPTION_PLANS.SUBSCRIBERS_VIEW)
  @ApiOperation({
    summary: 'Tenants whose latest subscription is still active',
    description:
      'Omit planId for every such tenant. Pass planId to limit the roster to that plan.',
  })
  @ApiResponse({ status: 200, description: 'Active subscriber roster' })
  @ApiNotFoundResponse({ description: 'Subscription plan not found' })
  subscribers(
    @Query() query: ListSubscriptionSubscribersQueryDto,
  ): Promise<PaginatedSubscriptionSubscribersResponse> {
    return this.stats.subscribers(query);
  }

  @Get(':id/stats')
  @Permission(PERMISSIONS.PLATFORM_SUBSCRIPTION_PLANS.STATS_VIEW)
  @ApiOperation({
    summary: 'Active subscribers and transactions initiated for one plan',
  })
  @ApiNotFoundResponse({ description: 'Subscription plan not found' })
  planStats(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<SubscriptionPlanStatsResponse> {
    return this.stats.planStats(id);
  }

  @Get(':id')
  @Permission(PERMISSIONS.PLATFORM_SUBSCRIPTION_PLANS.READ)
  @ApiOperation({ summary: 'One subscription plan, without performance stats' })
  @ApiNotFoundResponse({ description: 'Subscription plan not found' })
  detail(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<SubscriptionPlanResponse> {
    return this.plans.get(id);
  }

  @Patch(':id')
  @Permission(PERMISSIONS.PLATFORM_SUBSCRIPTION_PLANS.UPDATE)
  @ApiOperation({
    summary: 'Update plan name or price',
    description:
      'billingCycle and durationInDays stay fixed. Price changes apply to future checkouts only.',
  })
  @ApiNotFoundResponse({ description: 'Subscription plan not found' })
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSubscriptionPlanDto,
  ): Promise<SubscriptionPlanResponse> {
    return this.plans.update(id, dto, extractAuditRequestContext(request));
  }

  @Patch(':id/status')
  @Permission(PERMISSIONS.PLATFORM_SUBSCRIPTION_PLANS.STATUS_UPDATE)
  @ApiOperation({
    summary: 'Activate or deactivate a plan',
    description:
      'Deactivated plans cannot be used for new checkouts. Granted subscriptions run until endsAt.',
  })
  @ApiNotFoundResponse({ description: 'Subscription plan not found' })
  updateStatus(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSubscriptionPlanStatusDto,
  ): Promise<SubscriptionPlanResponse> {
    return this.plans.updateStatus(
      id,
      dto.isActive,
      extractAuditRequestContext(request),
    );
  }

  @Post(':id/discounts')
  @Permission(PERMISSIONS.PLATFORM_SUBSCRIPTION_PLANS.UPDATE)
  @ApiOperation({ summary: 'Schedule a discount on a subscription plan' })
  @ApiResponse({ status: 201, description: 'Updated plan with discounts' })
  @ApiNotFoundResponse({ description: 'Subscription plan not found' })
  @ApiConflictResponse({
    description: 'Another active discount already covers this period',
  })
  createDiscount(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreatePlanDiscountDto,
  ): Promise<SubscriptionPlanResponse> {
    return this.discounts.create(id, dto, extractAuditRequestContext(request));
  }

  @Patch(':id/discounts/:discountId')
  @Permission(PERMISSIONS.PLATFORM_SUBSCRIPTION_PLANS.UPDATE)
  @ApiOperation({ summary: 'Update a scheduled plan discount' })
  @ApiNotFoundResponse({
    description: 'Subscription plan or discount not found',
  })
  @ApiConflictResponse({
    description: 'Another active discount already covers this period',
  })
  updateDiscount(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Param('discountId', ParseIntPipe) discountId: number,
    @Body() dto: UpdatePlanDiscountDto,
  ): Promise<SubscriptionPlanResponse> {
    return this.discounts.update(
      id,
      discountId,
      dto,
      extractAuditRequestContext(request),
    );
  }

  @Delete(':id/discounts/:discountId')
  @Permission(PERMISSIONS.PLATFORM_SUBSCRIPTION_PLANS.UPDATE)
  @ApiOperation({ summary: 'Remove a scheduled plan discount' })
  @ApiNotFoundResponse({
    description: 'Subscription plan or discount not found',
  })
  removeDiscount(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Param('discountId', ParseIntPipe) discountId: number,
  ): Promise<SubscriptionPlanResponse> {
    return this.discounts.remove(
      id,
      discountId,
      extractAuditRequestContext(request),
    );
  }

  @Delete(':id')
  @Permission(PERMISSIONS.PLATFORM_SUBSCRIPTION_PLANS.DELETE)
  @ApiOperation({
    summary: 'Delete a plan with no history, otherwise deactivate it',
  })
  @ApiNotFoundResponse({ description: 'Subscription plan not found' })
  remove(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<SubscriptionPlanRemovalResponse> {
    return this.plans.remove(id, extractAuditRequestContext(request));
  }
}
