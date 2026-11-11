import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { OptionalAuth } from '../../../auth/shared/decorators/optional-auth.decorator';
import { OptionalCurrentUser } from '../../../auth/shared/decorators/optional-current-user.decorator';
import { Public } from '../../../auth/shared/decorators/public.decorator';
import type { AuthenticatedUser } from '../../../auth/shared/types/authenticated-user.type';
import { ListPublicTenantsQueryDto } from '../dto/list-public-tenants-query.dto';
import {
  PublicTenantsService,
  type PublicBrandCatalogListResponse,
  type PublicBrandDetail,
  type PublicTenantWorkspaceResponse,
} from '../services/public-tenants.service';

@ApiTags('Tenants - Public')
@Controller('public/tenants')
export class PublicTenantsController {
  constructor(private readonly publicTenantsService: PublicTenantsService) {}

  @Public()
  @OptionalAuth()
  @Get()
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary:
      'List brands that can accept loan applications (browse). Named search returns matches even when not ready. Optional Bearer JWT attaches isFavorite for platform customers.',
  })
  @ApiResponse({ status: 200, description: 'Paginated brand catalog' })
  findAll(
    @Query() query: ListPublicTenantsQueryDto,
    @OptionalCurrentUser() user?: AuthenticatedUser,
  ): Promise<PublicBrandCatalogListResponse> {
    return this.publicTenantsService.findAllPublic(query, user);
  }

  @Public()
  @Get('resolve/:identifier')
  @ApiOperation({
    summary: 'Resolve an active tenant by slug or tenant code',
  })
  @ApiResponse({ status: 200, description: 'Public workspace branding config' })
  @ApiNotFoundResponse({ description: 'No matching active tenant' })
  resolve(
    @Param('identifier') identifier: string,
  ): Promise<PublicTenantWorkspaceResponse> {
    return this.publicTenantsService.resolve(identifier);
  }

  @Public()
  @OptionalAuth()
  @Get(':identifier')
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary:
      'Get brand detail by uuid, slug, or tenant code (about + published agreements)',
  })
  @ApiResponse({ status: 200, description: 'Public brand detail' })
  @ApiNotFoundResponse({
    description: 'Financial institution brand not found or unavailable',
  })
  findOne(
    @Param('identifier') identifier: string,
    @OptionalCurrentUser() user?: AuthenticatedUser,
  ): Promise<PublicBrandDetail> {
    return this.publicTenantsService.findOnePublic(identifier, user);
  }
}
