import { Body, Controller, Get, Patch, Post, Req } from '@nestjs/common';
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
import { extractAuditRequestContext } from '../../../../../core/audit/utils/audit-request-context.util';
import { Permission } from '../../../../auth/shared/decorators/permission.decorator';
import { PERMISSIONS } from '../../../../auth/shared/constants/permissions.constant';
import type { AuthenticatedRequest } from '../../../../auth/shared/guards/permission.guard';
import { CreateBrandAboutDto } from '../dto/create-brand-about.dto';
import { UpdateBrandAboutDto } from '../dto/update-brand-about.dto';
import {
  BrandAboutService,
  type BrandAboutResponse,
  type CreateBrandAboutResponse,
  type UpdateBrandAboutResponse,
} from '../services/brand-about.service';

@ApiTags('Brand About')
@ApiBearerAuth('bearer')
@Controller('system-configurations/about')
export class BrandAboutController {
  constructor(private readonly brandAboutService: BrandAboutService) {}

  @Get()
  @Permission(PERMISSIONS.SYSTEM_CONFIGURATIONS.READ)
  @ApiOperation({ summary: 'Retrieve brand about details' })
  @ApiResponse({ status: 200, description: 'Current brand about details' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  getAboutDetails(): Promise<BrandAboutResponse> {
    return this.brandAboutService.getAboutDetails();
  }

  @Post()
  @Permission(PERMISSIONS.SYSTEM_CONFIGURATIONS.MANAGE)
  @ApiOperation({ summary: 'Create brand about details' })
  @ApiResponse({ status: 201, description: 'Brand about details created' })
  @ApiConflictResponse({ description: 'Brand about details already exist' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  createAboutDetails(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateBrandAboutDto,
  ): Promise<CreateBrandAboutResponse> {
    return this.brandAboutService.createAboutDetails(
      dto,
      extractAuditRequestContext(request),
    );
  }

  @Patch()
  @Permission(PERMISSIONS.SYSTEM_CONFIGURATIONS.MANAGE)
  @ApiOperation({ summary: 'Update brand about details' })
  @ApiResponse({ status: 200, description: 'Brand about details updated' })
  @ApiNotFoundResponse({ description: 'Brand about details not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  updateAboutDetails(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateBrandAboutDto,
  ): Promise<UpdateBrandAboutResponse> {
    return this.brandAboutService.updateAboutDetails(
      dto,
      extractAuditRequestContext(request),
    );
  }
}
