import {
  Body,
  Controller,
  Get,
  Header,
  Param,
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
} from '@nestjs/swagger';
import { extractAuditRequestContext } from '../../../../core/audit/utils/audit-request-context.util';
import { RequestOriginService } from '../../../../core/config/request-origin.service';
import { PERMISSIONS } from '../../../auth/shared/constants/permissions.constant';
import { Permission } from '../../../auth/shared/decorators/permission.decorator';
import type { AuthenticatedRequest } from '../../../auth/shared/guards/permission.guard';
import { ManagedUserIdentityDocumentsService } from '../../../users/managed-user/shared/services/managed-user-identity-documents.service';
import type { IdentityDocumentResponse } from '../../../users/shared/services/identity-document-storage.service';
import { AssignPlatformTenantMemberDto } from '../dto/assign-platform-tenant-member.dto';
import { OnboardTenantDto } from '../dto/onboard-tenant.dto';
import { ListPlatformTenantMembersQueryDto } from '../dto/list-platform-tenant-members-query.dto';
import { ListPlatformTenantsQueryDto } from '../dto/list-platform-tenants-query.dto';
import {
  PlatformTenantsService,
  type PaginatedPlatformTenantMembersResponse,
  type PaginatedPlatformTenantsResponse,
  type PlatformTenantDetail,
  type PlatformTenantMemberDetail,
  type TenantOnboardingResponse,
} from '../services/platform-tenants.service';

@ApiTags('Tenants - Platform')
@ApiBearerAuth('bearer')
@Controller('platform/tenants')
export class PlatformTenantsController {
  constructor(
    private readonly platformTenantsService: PlatformTenantsService,
    private readonly managedUserIdentityDocumentsService: ManagedUserIdentityDocumentsService,
    private readonly requestOriginService: RequestOriginService,
  ) {}

  @Get()
  @Permission(PERMISSIONS.PLATFORM.TENANTS_READ)
  @ApiOperation({
    summary:
      'List tenants for platform inspection (optional isActive / subscription / payment filters)',
  })
  @ApiResponse({ status: 200, description: 'Paginated tenant list' })
  listTenants(
    @Query() query: ListPlatformTenantsQueryDto,
  ): Promise<PaginatedPlatformTenantsResponse> {
    return this.platformTenantsService.findAll(query);
  }

  @Post(':uuid/members')
  @Permission(PERMISSIONS.PLATFORM.TENANTS_MANAGE)
  @ApiOperation({
    summary:
      'Assign an existing platform user to a tenant (clears all roles; tenant admin must re-assign)',
  })
  @ApiResponse({
    status: 201,
    description:
      'User linked to tenant with no roles until a tenant administrator assigns them',
  })
  @ApiNotFoundResponse({ description: 'Tenant or user not found' })
  @ApiConflictResponse({
    description: 'User already belongs to an organization',
  })
  @ApiForbiddenResponse({
    description: 'Reserved or Super Admin accounts cannot be assigned',
  })
  assignTenantMember(
    @Req() request: AuthenticatedRequest,
    @Param('uuid') uuid: string,
    @Body() dto: AssignPlatformTenantMemberDto,
  ): Promise<PlatformTenantMemberDetail> {
    return this.platformTenantsService.assignMember(
      uuid,
      dto,
      extractAuditRequestContext(request),
    );
  }

  @Get(':uuid/members')
  @Permission(PERMISSIONS.PLATFORM.TENANTS_READ)
  @ApiOperation({
    summary: 'List members in a tenant workspace (paginated, searchable)',
  })
  @ApiResponse({ status: 200, description: 'Paginated tenant members' })
  @ApiNotFoundResponse({ description: 'Tenant not found' })
  listTenantMembers(
    @Param('uuid') uuid: string,
    @Query() query: ListPlatformTenantMembersQueryDto,
  ): Promise<PaginatedPlatformTenantMembersResponse> {
    return this.platformTenantsService.findMembers(uuid, query);
  }

  @Get(':uuid/members/:userId')
  @Permission(PERMISSIONS.PLATFORM.TENANTS_READ)
  @ApiOperation({ summary: 'Get a read-only member profile within a tenant' })
  @ApiResponse({ status: 200, description: 'Tenant member profile' })
  @ApiNotFoundResponse({ description: 'Tenant or member not found' })
  getTenantMember(
    @Param('uuid') uuid: string,
    @Param('userId') userId: string,
  ): Promise<PlatformTenantMemberDetail> {
    return this.platformTenantsService.findMember(uuid, userId);
  }

  @Get(':uuid/members/:userId/identity-document')
  @Permission(PERMISSIONS.PLATFORM.TENANTS_READ)
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    summary:
      'Get a tenant member identity document and signature (platform inspection)',
  })
  @ApiResponse({
    status: 200,
    description:
      'Identity document and signature (null data URLs when a file is missing)',
  })
  @ApiNotFoundResponse({
    description: 'Tenant not found, or user is not a member of that tenant',
  })
  getTenantMemberIdentityDocument(
    @Param('uuid') uuid: string,
    @Param('userId') userId: string,
  ): Promise<IdentityDocumentResponse> {
    return this.managedUserIdentityDocumentsService.getManagedUserIdentityDocument(
      userId,
      { kind: 'tenant-member', tenantId: uuid },
    );
  }

  @Get(':uuid')
  @Permission(PERMISSIONS.PLATFORM.TENANTS_READ)
  @ApiOperation({
    summary:
      'Get a read-only tenant inspection snapshot (members, roles, approvals)',
  })
  @ApiResponse({ status: 200, description: 'Tenant snapshot' })
  @ApiNotFoundResponse({ description: 'Tenant not found' })
  getTenant(@Param('uuid') uuid: string): Promise<PlatformTenantDetail> {
    return this.platformTenantsService.findOne(uuid);
  }

  @Post()
  @Permission(PERMISSIONS.PLATFORM.TENANTS_CREATE)
  @ApiOperation({
    summary:
      'Onboard a tenant with a seeded Administrator role and representative',
  })
  @ApiResponse({ status: 201, description: 'Tenant onboarded' })
  @ApiConflictResponse({
    description:
      'Slug, tenant code, username, email, or national ID already in use',
  })
  @ApiForbiddenResponse({
    description: 'Reserved platform accounts cannot be linked as administrator',
  })
  onboard(
    @Req() request: AuthenticatedRequest,
    @Body() dto: OnboardTenantDto,
  ): Promise<TenantOnboardingResponse> {
    return this.platformTenantsService.onboard(
      dto,
      extractAuditRequestContext(request),
      this.requestOriginService.resolve(request),
    );
  }
}
