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
import { AllowExpiredSubscription } from '../../auth/shared/decorators/allow-expired-subscription.decorator';
import { Permission } from '../../auth/shared/decorators/permission.decorator';
import type { AuthenticatedRequest } from '../../auth/shared/guards/permission.guard';
import { resolveCallerTenantId } from '../../roles/shared/utils/resolve-caller-tenant.util';
import { ListSubscriptionHistoryQueryDto } from '../dto/list-subscription-history-query.dto';
import {
  TenantSubscriptionsService,
  type PaginatedTenantSubscriptionHistoryResponse,
  type TenantSubscriptionAccessResponse,
  type TenantSubscriptionDetailResponse,
} from '../services/tenant-subscriptions.service';

@ApiTags('Subscriptions')
@ApiBearerAuth('bearer')
@AllowExpiredSubscription()
@Controller('subscriptions')
export class TenantSubscriptionsController {
  constructor(private readonly subscriptions: TenantSubscriptionsService) {}

  @Get('access')
  @Permission(PERMISSIONS.SUBSCRIPTIONS.ACCESS_VIEW)
  @ApiOperation({
    summary: 'Current institution access, including trial and days remaining',
    description:
      'Also returns platformContact (Orion Call / WhatsApp / Email) for manual-payment UX when online checkout is disabled. Same payload is mirrored on login/session as user.tenant.subscription.',
  })
  @ApiResponse({ status: 200, description: 'Current subscription access' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or tenant membership required',
  })
  access(
    @Req() request: AuthenticatedRequest,
  ): Promise<TenantSubscriptionAccessResponse> {
    return this.subscriptions.access(resolveCallerTenantId(request.user));
  }

  @Get('history')
  @Permission(PERMISSIONS.SUBSCRIPTIONS.HISTORY_VIEW)
  @ApiOperation({
    summary: 'Institution subscription grants, newest coverage first',
  })
  @ApiResponse({ status: 200, description: 'Subscription history' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or tenant membership required',
  })
  history(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListSubscriptionHistoryQueryDto,
  ): Promise<PaginatedTenantSubscriptionHistoryResponse> {
    return this.subscriptions.history(
      resolveCallerTenantId(request.user),
      query.page,
      query.limit,
    );
  }

  @Get('history/:id')
  @Permission(PERMISSIONS.SUBSCRIPTIONS.HISTORY_VIEW)
  @ApiOperation({
    summary:
      'One subscription grant, including who issued it and the purchase transaction events',
  })
  @ApiNotFoundResponse({ description: 'Subscription not found' })
  get(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TenantSubscriptionDetailResponse> {
    return this.subscriptions.get(resolveCallerTenantId(request.user), id);
  }
}
