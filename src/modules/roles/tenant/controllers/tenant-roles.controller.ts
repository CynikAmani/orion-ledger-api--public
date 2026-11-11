import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { extractAuditRequestContext } from '../../../../core/audit/utils/audit-request-context.util';
import { PERMISSIONS } from '../../../auth/shared/constants/permissions.constant';
import { Permission } from '../../../auth/shared/decorators/permission.decorator';
import type { AuthenticatedRequest } from '../../../auth/shared/guards/permission.guard';
import { CreateManagedRoleDto } from '../../shared/dto/create-managed-role.dto';
import { SyncManagedRolePermissionsDto } from '../../shared/dto/sync-managed-role-permissions.dto';
import { UpdateManagedRoleDto } from '../../shared/dto/update-managed-role.dto';
import { TENANT_ID_HEADER } from '../../shared/utils/resolve-caller-tenant.util';
import type {
  ManagedPermissionResponse,
  ManagedRoleResponse,
} from '../../shared/services/role-management.service';
import { TenantRolesService } from '../services/tenant-roles.service';

@ApiTags('Role Management - Tenant')
@ApiBearerAuth('bearer')
@ApiHeader({
  name: TENANT_ID_HEADER,
  required: false,
  description:
    'Required when the caller belongs to more than one tenant. Must match an active membership.',
})
@Controller('tenant/roles')
export class TenantRolesController {
  constructor(private readonly tenantRolesService: TenantRolesService) {}

  @Get()
  @Permission(PERMISSIONS.TENANT.ROLES_READ)
  @ApiOperation({
    summary: "List roles for the caller's active tenant",
  })
  @ApiResponse({ status: 200, description: 'Tenant role list' })
  listRoles(
    @Req() request: AuthenticatedRequest,
    @Headers(TENANT_ID_HEADER) tenantId?: string,
  ): Promise<ManagedRoleResponse[]> {
    return this.tenantRolesService.listRoles(request.user, tenantId);
  }

  @Get('permissions')
  @Permission(PERMISSIONS.TENANT.ROLES_READ)
  @ApiOperation({
    summary:
      'List tenant:*, self:*, inbox notification (view/read/delete), and platform:customers:* permissions available to assign',
  })
  @ApiResponse({ status: 200, description: 'Tenant permission catalog' })
  listCatalogPermissions(): Promise<ManagedPermissionResponse[]> {
    return this.tenantRolesService.listCatalogPermissions();
  }

  @Get(':publicId')
  @Permission(PERMISSIONS.TENANT.ROLES_READ)
  @ApiOperation({ summary: 'Get a tenant role by public id' })
  @ApiResponse({ status: 200, description: 'Tenant role' })
  @ApiNotFoundResponse({ description: 'Role not found' })
  getRole(
    @Req() request: AuthenticatedRequest,
    @Param('publicId') publicId: string,
    @Headers(TENANT_ID_HEADER) tenantId?: string,
  ): Promise<ManagedRoleResponse> {
    return this.tenantRolesService.getRole(request.user, publicId, tenantId);
  }

  @Get(':publicId/permissions')
  @Permission(PERMISSIONS.TENANT.ROLES_READ)
  @ApiOperation({
    summary: 'List permissions currently assigned to a tenant role',
  })
  @ApiResponse({ status: 200, description: 'Assigned permission names' })
  @ApiNotFoundResponse({ description: 'Role not found' })
  async listRolePermissions(
    @Req() request: AuthenticatedRequest,
    @Param('publicId') publicId: string,
    @Headers(TENANT_ID_HEADER) tenantId?: string,
  ): Promise<string[]> {
    const role = await this.tenantRolesService.getRole(
      request.user,
      publicId,
      tenantId,
    );
    return role.permissions;
  }

  @Post()
  @Permission(PERMISSIONS.TENANT.ROLES_CREATE)
  @ApiOperation({ summary: "Create a role in the caller's active tenant" })
  @ApiResponse({ status: 201, description: 'Tenant role created' })
  @ApiConflictResponse({ description: 'Role key already exists' })
  createRole(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateManagedRoleDto,
    @Headers(TENANT_ID_HEADER) tenantId?: string,
  ): Promise<ManagedRoleResponse> {
    return this.tenantRolesService.createRole(
      request.user,
      dto,
      extractAuditRequestContext(request),
      tenantId,
    );
  }

  @Patch(':publicId')
  @Permission(PERMISSIONS.TENANT.ROLES_UPDATE)
  @ApiOperation({ summary: 'Update a tenant role display name' })
  @ApiResponse({ status: 200, description: 'Tenant role updated' })
  @ApiNotFoundResponse({ description: 'Role not found' })
  updateRole(
    @Req() request: AuthenticatedRequest,
    @Param('publicId') publicId: string,
    @Body() dto: UpdateManagedRoleDto,
    @Headers(TENANT_ID_HEADER) tenantId?: string,
  ): Promise<ManagedRoleResponse> {
    return this.tenantRolesService.updateRole(
      request.user,
      publicId,
      dto,
      extractAuditRequestContext(request),
      tenantId,
    );
  }

  @Delete(':publicId')
  @Permission(PERMISSIONS.TENANT.ROLES_DELETE)
  @ApiOperation({ summary: 'Delete a tenant role' })
  @ApiResponse({ status: 200, description: 'Tenant role deleted' })
  @ApiNotFoundResponse({ description: 'Role not found' })
  deleteRole(
    @Req() request: AuthenticatedRequest,
    @Param('publicId') publicId: string,
    @Headers(TENANT_ID_HEADER) tenantId?: string,
  ): Promise<void> {
    return this.tenantRolesService.deleteRole(
      request.user,
      publicId,
      extractAuditRequestContext(request),
      tenantId,
    );
  }

  @Put(':publicId/permissions')
  @Permission(PERMISSIONS.TENANT.ROLES_MANAGE)
  @ApiOperation({
    summary:
      'Replace tenant role permissions (tenant:*, self:*, inbox notifications, and platform:customers:*)',
  })
  @ApiResponse({ status: 200, description: 'Permissions synced' })
  @ApiNotFoundResponse({ description: 'Role or permission not found' })
  syncPermissions(
    @Req() request: AuthenticatedRequest,
    @Param('publicId') publicId: string,
    @Body() dto: SyncManagedRolePermissionsDto,
    @Headers(TENANT_ID_HEADER) tenantId?: string,
  ): Promise<ManagedRoleResponse> {
    return this.tenantRolesService.syncPermissions(
      request.user,
      publicId,
      dto,
      extractAuditRequestContext(request),
      tenantId,
    );
  }
}
