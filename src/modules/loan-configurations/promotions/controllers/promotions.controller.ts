import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
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
import { extractAuditRequestContext } from '../../../../core/audit/utils/audit-request-context.util';
import { Permission } from '../../../auth/shared/decorators/permission.decorator';
import { PERMISSIONS } from '../../../auth/shared/constants/permissions.constant';
import type { AuthenticatedRequest } from '../../../auth/shared/guards/permission.guard';
import { resolveCallerTenantId } from '../../../roles/shared/utils/resolve-caller-tenant.util';
import { CreatePromotionDto } from '../dto/create-promotion.dto';
import {
  PromotionsService,
  type PromotionResponse,
} from '../services/promotions.service';

@ApiTags('Promotions')
@ApiBearerAuth('bearer')
@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Post()
  @Permission(PERMISSIONS.LOAN_CONFIGURATIONS.PROMOTIONS_CREATE)
  @ApiOperation({ summary: 'Schedule a new promotion for the caller\'s tenant' })
  @ApiResponse({ status: 201, description: 'Promotion scheduled' })
  @ApiConflictResponse({
    description: 'Date range overlaps an existing promotion',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or tenant membership required',
  })
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreatePromotionDto,
  ): Promise<PromotionResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.promotionsService.create(
      tenantId,
      dto,
      extractAuditRequestContext(request),
    );
  }

  @Get('active')
  @Permission(PERMISSIONS.LOAN_CONFIGURATIONS.PROMOTIONS_READ)
  @ApiOperation({
    summary: 'Get the currently active promotion for the caller\'s tenant',
  })
  @ApiResponse({ status: 200, description: 'Active promotion or null' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or tenant membership required',
  })
  findActive(
    @Req() request: AuthenticatedRequest,
  ): Promise<PromotionResponse | null> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.promotionsService.findActive(tenantId);
  }

  @Get('upcoming')
  @Permission(PERMISSIONS.LOAN_CONFIGURATIONS.PROMOTIONS_READ)
  @ApiOperation({
    summary: 'List scheduled future promotions for the caller\'s tenant',
  })
  @ApiResponse({ status: 200, description: 'Upcoming promotions' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or tenant membership required',
  })
  findUpcoming(
    @Req() request: AuthenticatedRequest,
  ): Promise<PromotionResponse[]> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.promotionsService.findUpcoming(tenantId);
  }

  @Get('history')
  @Permission(PERMISSIONS.LOAN_CONFIGURATIONS.PROMOTIONS_READ)
  @ApiOperation({
    summary: 'List past/expired promotions for the caller\'s tenant',
  })
  @ApiResponse({ status: 200, description: 'Expired promotions' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or tenant membership required',
  })
  findHistory(
    @Req() request: AuthenticatedRequest,
  ): Promise<PromotionResponse[]> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.promotionsService.findHistory(tenantId);
  }

  @Post(':id/cancel')
  @Permission(PERMISSIONS.LOAN_CONFIGURATIONS.PROMOTIONS_CANCEL)
  @ApiOperation({
    summary:
      'Cancel a scheduled or active promotion for the caller\'s tenant (restores rates if active)',
  })
  @ApiResponse({ status: 200, description: 'Promotion cancelled' })
  @ApiNotFoundResponse({ description: 'Promotion not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or tenant membership required',
  })
  cancel(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string }> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.promotionsService.cancel(
      tenantId,
      id,
      extractAuditRequestContext(request),
    );
  }
}
