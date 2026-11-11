import { Injectable } from '@nestjs/common';
import type { AuditContext } from '../../../../core/audit/interfaces/audit-payload.interface';
import type { AuthenticatedUser } from '../../../auth/shared/types/authenticated-user.type';
import { TENANT_PERMISSION_PREFIX } from '../../shared/utils/role-permission-scope.util';
import { resolveCallerTenantId } from '../../shared/utils/resolve-caller-tenant.util';
import { CreateManagedRoleDto } from '../../shared/dto/create-managed-role.dto';
import { SyncManagedRolePermissionsDto } from '../../shared/dto/sync-managed-role-permissions.dto';
import { UpdateManagedRoleDto } from '../../shared/dto/update-managed-role.dto';
import {
  RoleManagementService,
  type ManagedPermissionResponse,
  type ManagedRoleResponse,
  type RoleManagementScope,
} from '../../shared/services/role-management.service';

@Injectable()
export class TenantRolesService {
  constructor(private readonly roleManagement: RoleManagementService) {}

  listRoles(
    user: AuthenticatedUser,
    requestedTenantId?: string | string[],
  ): Promise<ManagedRoleResponse[]> {
    return this.roleManagement.listRoles(
      this.scopeFor(user, requestedTenantId),
    );
  }

  getRole(
    user: AuthenticatedUser,
    publicId: string,
    requestedTenantId?: string | string[],
  ): Promise<ManagedRoleResponse> {
    return this.roleManagement.getRole(
      this.scopeFor(user, requestedTenantId),
      publicId,
    );
  }

  createRole(
    user: AuthenticatedUser,
    dto: CreateManagedRoleDto,
    auditContext: AuditContext,
    requestedTenantId?: string | string[],
  ): Promise<ManagedRoleResponse> {
    return this.roleManagement.createRole(
      this.scopeFor(user, requestedTenantId),
      dto,
      auditContext,
    );
  }

  updateRole(
    user: AuthenticatedUser,
    publicId: string,
    dto: UpdateManagedRoleDto,
    auditContext: AuditContext,
    requestedTenantId?: string | string[],
  ): Promise<ManagedRoleResponse> {
    return this.roleManagement.updateRole(
      this.scopeFor(user, requestedTenantId),
      publicId,
      dto,
      auditContext,
    );
  }

  deleteRole(
    user: AuthenticatedUser,
    publicId: string,
    auditContext: AuditContext,
    requestedTenantId?: string | string[],
  ): Promise<void> {
    return this.roleManagement.deleteRole(
      this.scopeFor(user, requestedTenantId),
      publicId,
      auditContext,
    );
  }

  listCatalogPermissions(): Promise<ManagedPermissionResponse[]> {
    return this.roleManagement.listCatalogPermissions(TENANT_PERMISSION_PREFIX);
  }

  syncPermissions(
    user: AuthenticatedUser,
    publicId: string,
    dto: SyncManagedRolePermissionsDto,
    auditContext: AuditContext,
    requestedTenantId?: string | string[],
  ): Promise<ManagedRoleResponse> {
    return this.roleManagement.syncPermissions(
      this.scopeFor(user, requestedTenantId),
      publicId,
      dto,
      TENANT_PERMISSION_PREFIX,
      auditContext,
    );
  }

  private scopeFor(
    user: AuthenticatedUser,
    requestedTenantId?: string | string[],
  ): RoleManagementScope {
    return {
      kind: 'tenant',
      tenantId: resolveCallerTenantId(user, requestedTenantId),
    };
  }
}
