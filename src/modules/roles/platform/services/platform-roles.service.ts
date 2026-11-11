import { Injectable } from '@nestjs/common';
import type { AuditContext } from '../../../../core/audit/interfaces/audit-payload.interface';
import { PLATFORM_PERMISSION_PREFIX } from '../../shared/utils/role-permission-scope.util';
import { CreateManagedRoleDto } from '../../shared/dto/create-managed-role.dto';
import { SyncManagedRolePermissionsDto } from '../../shared/dto/sync-managed-role-permissions.dto';
import { UpdateManagedRoleDto } from '../../shared/dto/update-managed-role.dto';
import {
  RoleManagementService,
  type ManagedPermissionResponse,
  type ManagedRoleResponse,
} from '../../shared/services/role-management.service';

const PLATFORM_SCOPE = { kind: 'platform' as const };

@Injectable()
export class PlatformRolesService {
  constructor(private readonly roleManagement: RoleManagementService) {}

  listRoles(): Promise<ManagedRoleResponse[]> {
    return this.roleManagement.listRoles(PLATFORM_SCOPE);
  }

  getRole(publicId: string): Promise<ManagedRoleResponse> {
    return this.roleManagement.getRole(PLATFORM_SCOPE, publicId);
  }

  createRole(
    dto: CreateManagedRoleDto,
    auditContext: AuditContext,
  ): Promise<ManagedRoleResponse> {
    return this.roleManagement.createRole(PLATFORM_SCOPE, dto, auditContext);
  }

  updateRole(
    publicId: string,
    dto: UpdateManagedRoleDto,
    auditContext: AuditContext,
  ): Promise<ManagedRoleResponse> {
    return this.roleManagement.updateRole(
      PLATFORM_SCOPE,
      publicId,
      dto,
      auditContext,
    );
  }

  deleteRole(publicId: string, auditContext: AuditContext): Promise<void> {
    return this.roleManagement.deleteRole(
      PLATFORM_SCOPE,
      publicId,
      auditContext,
    );
  }

  listCatalogPermissions(): Promise<ManagedPermissionResponse[]> {
    return this.roleManagement.listCatalogPermissions(
      PLATFORM_PERMISSION_PREFIX,
    );
  }

  syncPermissions(
    publicId: string,
    dto: SyncManagedRolePermissionsDto,
    auditContext: AuditContext,
  ): Promise<ManagedRoleResponse> {
    return this.roleManagement.syncPermissions(
      PLATFORM_SCOPE,
      publicId,
      dto,
      PLATFORM_PERMISSION_PREFIX,
      auditContext,
    );
  }
}
