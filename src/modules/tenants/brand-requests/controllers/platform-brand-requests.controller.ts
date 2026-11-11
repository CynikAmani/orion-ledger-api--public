import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { extractAuditRequestContext } from '../../../../core/audit/utils/audit-request-context.util';
import { PERMISSIONS } from '../../../auth/shared/constants/permissions.constant';
import { Permission } from '../../../auth/shared/decorators/permission.decorator';
import type { AuthenticatedRequest } from '../../../auth/shared/guards/permission.guard';
import { ListBrandOnboardingRequestsQueryDto } from '../dto/list-brand-onboarding-requests-query.dto';
import { ApproveBrandOnboardingRequestDto } from '../dto/approve-brand-onboarding-request.dto';
import { RejectBrandOnboardingRequestDto } from '../dto/reject-brand-onboarding-request.dto';
import {
  BrandOnboardingRequestsService,
  type BrandOnboardingRequestResponse,
  type PaginatedBrandOnboardingRequestsResponse,
} from '../services/brand-onboarding-requests.service';

@ApiTags('Brand Requests - Platform')
@ApiBearerAuth('bearer')
@Controller('platform/brand-requests')
export class PlatformBrandRequestsController {
  constructor(
    private readonly brandOnboardingRequestsService: BrandOnboardingRequestsService,
  ) {}

  @Get()
  @Permission(PERMISSIONS.BRAND_REQUESTS.READ)
  @ApiOperation({
    summary: 'List brand onboarding requests (defaults to all statuses)',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated brand onboarding requests',
  })
  list(
    @Query() query: ListBrandOnboardingRequestsQueryDto,
  ): Promise<PaginatedBrandOnboardingRequestsResponse> {
    return this.brandOnboardingRequestsService.findAll(query);
  }

  @Get(':publicId')
  @Permission(PERMISSIONS.BRAND_REQUESTS.READ)
  @ApiOperation({
    summary: 'Get a brand onboarding request with applicant context',
  })
  @ApiResponse({ status: 200, description: 'Brand onboarding request found' })
  @ApiNotFoundResponse({ description: 'Brand onboarding request not found' })
  findOne(
    @Param('publicId') publicId: string,
  ): Promise<BrandOnboardingRequestResponse> {
    return this.brandOnboardingRequestsService.findOne(publicId);
  }

  @Post(':publicId/reject')
  @Permission(PERMISSIONS.BRAND_REQUESTS.REJECT)
  @ApiOperation({ summary: 'Reject a pending brand onboarding request' })
  @ApiResponse({ status: 201, description: 'Request rejected' })
  @ApiNotFoundResponse({ description: 'Brand onboarding request not found' })
  @ApiConflictResponse({ description: 'Request is not pending' })
  reject(
    @Req() request: AuthenticatedRequest,
    @Param('publicId') publicId: string,
    @Body() dto: RejectBrandOnboardingRequestDto,
  ): Promise<BrandOnboardingRequestResponse> {
    return this.brandOnboardingRequestsService.reject(
      publicId,
      request.user.id,
      dto,
      extractAuditRequestContext(request),
    );
  }

  @Post(':publicId/approve')
  @Permission(PERMISSIONS.BRAND_REQUESTS.APPROVE)
  @ApiOperation({
    summary:
      'Approve a pending request, provision the tenant, and attach the applicant as administrator',
  })
  @ApiResponse({
    status: 201,
    description: 'Tenant provisioned and request approved',
  })
  @ApiNotFoundResponse({ description: 'Brand onboarding request not found' })
  @ApiConflictResponse({
    description: 'Request is not pending, or slug/tenant code is taken',
  })
  approve(
    @Req() request: AuthenticatedRequest,
    @Param('publicId') publicId: string,
    @Body() dto: ApproveBrandOnboardingRequestDto,
  ): Promise<BrandOnboardingRequestResponse> {
    return this.brandOnboardingRequestsService.approve(
      publicId,
      request.user.id,
      dto,
      extractAuditRequestContext(request),
    );
  }
}
