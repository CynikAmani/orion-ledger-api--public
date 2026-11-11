import { Controller, Get, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
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
import {
  SubscriptionPlansService,
  type SubscriptionPlanResponse,
} from '../services/subscription-plans.service';

@ApiTags('Subscription plans')
@ApiBearerAuth('bearer')
@AllowExpiredSubscription()
@Controller('subscriptions/plans')
export class SubscriptionPlanCatalogController {
  constructor(private readonly plans: SubscriptionPlansService) {}

  @Get()
  @Permission(PERMISSIONS.SUBSCRIPTIONS.PLANS_READ)
  @ApiOperation({
    summary: 'Active subscription plans an institution can purchase',
  })
  @ApiResponse({ status: 200, description: 'Active plans' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or tenant membership required',
  })
  listActive(
    @Req() request: AuthenticatedRequest,
  ): Promise<SubscriptionPlanResponse[]> {
    resolveCallerTenantId(request.user);
    return this.plans.listActiveCatalog();
  }
}
