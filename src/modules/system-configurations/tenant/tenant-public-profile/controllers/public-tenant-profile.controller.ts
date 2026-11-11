import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../../../auth/shared/decorators/public.decorator';
import {
  PublicTenantProfileService,
  type PublicTenantProfileResponse,
} from '../services/public-tenant-profile.service';

@ApiTags('Tenants - Public Profile')
@Controller('public/tenants')
export class PublicTenantProfileController {
  constructor(
    private readonly publicTenantProfileService: PublicTenantProfileService,
  ) {}

  @Public()
  @Get(':slug/profile')
  @ApiOperation({
    summary:
      'Get published brand identity, about details, and active legal agreements for a tenant',
  })
  @ApiResponse({ status: 200, description: 'Public tenant profile' })
  @ApiNotFoundResponse({ description: 'No matching active tenant' })
  getProfile(
    @Param('slug') slug: string,
  ): Promise<PublicTenantProfileResponse> {
    return this.publicTenantProfileService.getProfileBySlug(slug);
  }
}
