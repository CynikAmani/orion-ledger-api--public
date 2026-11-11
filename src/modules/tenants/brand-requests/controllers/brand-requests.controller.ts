import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
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
import { PERMISSIONS } from '../../../auth/shared/constants/permissions.constant';
import { Permission } from '../../../auth/shared/decorators/permission.decorator';
import type { AuthenticatedRequest } from '../../../auth/shared/guards/permission.guard';
import { CreateBrandOnboardingRequestDto } from '../dto/create-brand-onboarding-request.dto';
import { UpdateBrandOnboardingRequestDto } from '../dto/update-brand-onboarding-request.dto';
import {
  BrandOnboardingRequestsService,
  type BrandOnboardingRequestResponse,
} from '../services/brand-onboarding-requests.service';

@ApiTags('Brand Requests')
@ApiBearerAuth('bearer')
@Controller('brand-requests')
export class BrandRequestsController {
  constructor(
    private readonly brandOnboardingRequestsService: BrandOnboardingRequestsService,
  ) {}

  @Post()
  @Permission(PERMISSIONS.BRAND_REQUESTS.CREATE)
  @ApiOperation({
    summary: 'Submit a brand onboarding request (platform customers only)',
  })
  @ApiResponse({ status: 201, description: 'Brand onboarding request created' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Tenant members cannot apply; platform customers only',
  })
  @ApiConflictResponse({
    description: 'Slug, tenant code, or pending request already exists',
  })
  submit(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateBrandOnboardingRequestDto,
  ): Promise<BrandOnboardingRequestResponse> {
    return this.brandOnboardingRequestsService.submit(
      {
        id: request.user.id,
        userId: request.user.userId,
        tenantId: request.user.tenantId,
      },
      dto,
      extractAuditRequestContext(request),
    );
  }

  @Get('my-requests')
  @Permission(PERMISSIONS.BRAND_REQUESTS.SELF_READ)
  @ApiOperation({ summary: 'List brand onboarding requests submitted by me' })
  @ApiResponse({ status: 200, description: 'Own brand onboarding requests' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  findMine(
    @Req() request: AuthenticatedRequest,
  ): Promise<BrandOnboardingRequestResponse[]> {
    return this.brandOnboardingRequestsService.findMine(request.user.id);
  }

  @Patch(':publicId')
  @Permission(PERMISSIONS.BRAND_REQUESTS.SELF_UPDATE)
  @ApiOperation({
    summary: 'Update details on my pending brand onboarding request',
  })
  @ApiResponse({ status: 200, description: 'Brand onboarding request updated' })
  @ApiNotFoundResponse({ description: 'Brand onboarding request not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Tenant members cannot update brand onboarding requests',
  })
  @ApiConflictResponse({
    description: 'Request is not pending, or slug/tenant code is taken',
  })
  updateMine(
    @Req() request: AuthenticatedRequest,
    @Param('publicId') publicId: string,
    @Body() dto: UpdateBrandOnboardingRequestDto,
  ): Promise<BrandOnboardingRequestResponse> {
    return this.brandOnboardingRequestsService.updateMine(
      {
        id: request.user.id,
        userId: request.user.userId,
        tenantId: request.user.tenantId,
      },
      publicId,
      dto,
      extractAuditRequestContext(request),
    );
  }

  @Post(':publicId/cancel')
  @Permission(PERMISSIONS.BRAND_REQUESTS.SELF_CANCEL)
  @ApiOperation({ summary: 'Cancel my pending brand onboarding request' })
  @ApiResponse({
    status: 201,
    description: 'Brand onboarding request cancelled',
  })
  @ApiNotFoundResponse({ description: 'Brand onboarding request not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Tenant members cannot cancel brand onboarding requests',
  })
  @ApiConflictResponse({ description: 'Request is not pending' })
  cancelMine(
    @Req() request: AuthenticatedRequest,
    @Param('publicId') publicId: string,
  ): Promise<BrandOnboardingRequestResponse> {
    return this.brandOnboardingRequestsService.cancelMine(
      {
        id: request.user.id,
        userId: request.user.userId,
        tenantId: request.user.tenantId,
      },
      publicId,
      extractAuditRequestContext(request),
    );
  }
}
