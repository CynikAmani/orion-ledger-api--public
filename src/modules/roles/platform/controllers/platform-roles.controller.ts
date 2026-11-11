import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
} from '@nestjs/common';
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
import { CreateManagedRoleDto } from '../../shared/dto/create-managed-role.dto';
import { SyncManagedRolePermissionsDto } from '../../shared/dto/sync-managed-role-permissions.dto';
import { UpdateManagedRoleDto } from '../../shared/dto/update-managed-role.dto';
import type {
  ManagedPermissionResponse,
  ManagedRoleResponse,
} from '../../shared/services/role-management.service';
import { PlatformRolesService } from '../services/platform-roles.service';

@ApiTags('Role Management - Platform')
@ApiBearerAuth('bearer')
@Controller('platform/roles')
export class PlatformRolesController {
  constructor(private readonly platformRolesService: PlatformRolesService) {}

  @Get()
  @Permission(PERMISSIONS.PLATFORM.ROLES_READ)
  @ApiOperation({
    summary: 'List platform roles (excludes Super Admin)',
  })
  @ApiResponse({ status: 200, description: 'Platform role list' })
  listRoles(): Promise<ManagedRoleResponse[]> {
    return this.platformRolesService.listRoles();
  }

  @Get('permissions')
  @Permission(PERMISSIONS.PLATFORM.ROLES_READ)
  @ApiOperation({
    summary:
      'List platform:*, self:*, and inbox notification (view/read/delete) permissions available to assign',
  })
  @ApiResponse({ status: 200, description: 'Platform permission catalog' })
  listCatalogPermissions(): Promise<ManagedPermissionResponse[]> {
    return this.platformRolesService.listCatalogPermissions();
  }

  @Get(':publicId')
  @Permission(PERMISSIONS.PLATFORM.ROLES_READ)
  @ApiOperation({ summary: 'Get a platform role by public id' })
  @ApiResponse({ status: 200, description: 'Platform role' })
  @ApiNotFoundResponse({ description: 'Role not found' })
  getRole(@Param('publicId') publicId: string): Promise<ManagedRoleResponse> {
    return this.platformRolesService.getRole(publicId);
  }

  @Get(':publicId/permissions')
  @Permission(PERMISSIONS.PLATFORM.ROLES_READ)
  @ApiOperation({
    summary: 'List permissions currently assigned to a platform role',
  })
  @ApiResponse({ status: 200, description: 'Assigned permission names' })
  @ApiNotFoundResponse({ description: 'Role not found' })
  async listRolePermissions(
    @Param('publicId') publicId: string,
  ): Promise<string[]> {
    const role = await this.platformRolesService.getRole(publicId);
    return role.permissions;
  }

  @Post()
  @Permission(PERMISSIONS.PLATFORM.ROLES_CREATE)
  @ApiOperation({ summary: 'Create a platform role' })
  @ApiResponse({ status: 201, description: 'Platform role created' })
  @ApiConflictResponse({ description: 'Role key already exists' })
  createRole(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateManagedRoleDto,
  ): Promise<ManagedRoleResponse> {
    return this.platformRolesService.createRole(
      dto,
      extractAuditRequestContext(request),
    );
  }

  @Patch(':publicId')
  @Permission(PERMISSIONS.PLATFORM.ROLES_UPDATE)
  @ApiOperation({ summary: 'Update a platform role display name' })
  @ApiResponse({ status: 200, description: 'Platform role updated' })
  @ApiNotFoundResponse({ description: 'Role not found' })
  updateRole(
    @Req() request: AuthenticatedRequest,
    @Param('publicId') publicId: string,
    @Body() dto: UpdateManagedRoleDto,
  ): Promise<ManagedRoleResponse> {
    return this.platformRolesService.updateRole(
      publicId,
      dto,
      extractAuditRequestContext(request),
    );
  }

  @Delete(':publicId')
  @Permission(PERMISSIONS.PLATFORM.ROLES_DELETE)
  @ApiOperation({ summary: 'Delete a platform role' })
  @ApiResponse({ status: 200, description: 'Platform role deleted' })
  @ApiNotFoundResponse({ description: 'Role not found' })
  deleteRole(
    @Req() request: AuthenticatedRequest,
    @Param('publicId') publicId: string,
  ): Promise<void> {
    return this.platformRolesService.deleteRole(
      publicId,
      extractAuditRequestContext(request),
    );
  }

  @Put(':publicId/permissions')
  @Permission(PERMISSIONS.PLATFORM.ROLES_MANAGE)
  @ApiOperation({
    summary:
      'Replace platform role permissions (platform:*, self:*, and inbox notifications)',
  })
  @ApiResponse({ status: 200, description: 'Permissions synced' })
  @ApiNotFoundResponse({ description: 'Role or permission not found' })
  syncPermissions(
    @Req() request: AuthenticatedRequest,
    @Param('publicId') publicId: string,
    @Body() dto: SyncManagedRolePermissionsDto,
  ): Promise<ManagedRoleResponse> {
    return this.platformRolesService.syncPermissions(
      publicId,
      dto,
      extractAuditRequestContext(request),
    );
  }
}
