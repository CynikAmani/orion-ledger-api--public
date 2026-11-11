import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuditContext } from '../../../../core/audit/interfaces/audit-payload.interface';
import { AuditEmitterService } from '../../../../core/audit/services/audit-emitter.service';
import { PrismaService } from '../../../../core/database/prisma.service';
import { SUPER_ADMIN_ROLE_KEY } from '../../../auth/shared/constants/roles.constant';
import { ROLE_MANAGEMENT_AUDIT_ACTIONS } from '../constants/role-management-audit-actions.constant';
import { CreateManagedRoleDto } from '../dto/create-managed-role.dto';
import { SyncManagedRolePermissionsDto } from '../dto/sync-managed-role-permissions.dto';
import { UpdateManagedRoleDto } from '../dto/update-managed-role.dto';
import {
  CUSTOMER_OPS_PERMISSION_PREFIX,
  GLOBAL_INBOX_PERMISSIONS,
  isPermissionInScope,
  SELF_PERMISSION_PREFIX,
  TENANT_PERMISSION_PREFIX,
  type RolePermissionPrefix,
} from '../utils/role-permission-scope.util';

export type RoleManagementScope =
  { kind: 'platform' } | { kind: 'tenant'; tenantId: string };

const ROLE_SELECT = {
  publicId: true,
  key: true,
  name: true,
  description: true,
  rolePermissions: {
    select: {
      permission: {
        select: { name: true },
      },
    },
    orderBy: { permission: { name: 'asc' as const } },
  },
} as const;

type RoleRecord = {
  publicId: string;
  key: string;
  name: string;
  description: string | null;
  rolePermissions: Array<{ permission: { name: string } }>;
};

export interface ManagedRoleResponse {
  publicId: string;
  key: string;
  name: string;
  description: string | null;
  permissions: string[];
}

export interface ManagedPermissionResponse {
  name: string;
  description: string | null;
}

@Injectable()
export class RoleManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditEmitter: AuditEmitterService,
  ) {}

  async listRoles(scope: RoleManagementScope): Promise<ManagedRoleResponse[]> {
    const roles = await this.prisma.role.findMany({
      where: {
        tenantId: this.scopeTenantId(scope),
        key: { not: SUPER_ADMIN_ROLE_KEY },
      },
      select: ROLE_SELECT,
      orderBy: { name: 'asc' },
    });

    return roles.map((role) => this.toResponse(role));
  }

  async getRole(
    scope: RoleManagementScope,
    publicId: string,
  ): Promise<ManagedRoleResponse> {
    return this.loadManageableRole(scope, publicId);
  }

  async createRole(
    scope: RoleManagementScope,
    dto: CreateManagedRoleDto,
    auditContext: AuditContext,
  ): Promise<ManagedRoleResponse> {
    this.assertNotReservedKey(dto.key);

    const tenantId = this.scopeTenantId(scope);
    const existing = await this.prisma.role.findFirst({
      where: { key: dto.key, tenantId },
      select: { roleId: true },
    });

    if (existing) {
      throw new ConflictException(
        `A role with key '${dto.key}' already exists in this scope`,
      );
    }

    const created = await this.prisma.role.create({
      data: {
        key: dto.key,
        name: dto.name,
        description: dto.description,
        tenantId,
      },
      select: ROLE_SELECT,
    });

    const response = this.toResponse(created);

    this.emitAudit(scope, auditContext, {
      action: ROLE_MANAGEMENT_AUDIT_ACTIONS.CREATED,
      targetId: response.publicId,
      payload: { key: dto.key, name: dto.name },
    });

    return response;
  }

  async updateRole(
    scope: RoleManagementScope,
    publicId: string,
    dto: UpdateManagedRoleDto,
    auditContext: AuditContext,
  ): Promise<ManagedRoleResponse> {
    const existing = await this.loadManageableRoleRecord(scope, publicId);

    const updated = await this.prisma.role.update({
      where: { publicId: existing.publicId },
      data: {
        name: dto.name,
        description: dto.description,
      },
      select: ROLE_SELECT,
    });

    const response = this.toResponse(updated);

    this.emitAudit(scope, auditContext, {
      action: ROLE_MANAGEMENT_AUDIT_ACTIONS.UPDATED,
      targetId: response.publicId,
      payload: { name: dto.name },
    });

    return response;
  }

  async deleteRole(
    scope: RoleManagementScope,
    publicId: string,
    auditContext: AuditContext,
  ): Promise<void> {
    const existing = await this.loadManageableRoleRecord(scope, publicId);

    await this.prisma.role.delete({
      where: { publicId: existing.publicId },
    });

    this.emitAudit(scope, auditContext, {
      action: ROLE_MANAGEMENT_AUDIT_ACTIONS.DELETED,
      targetId: existing.publicId,
      payload: { key: existing.key, name: existing.name },
    });
  }

  async listCatalogPermissions(
    prefix: RolePermissionPrefix,
  ): Promise<ManagedPermissionResponse[]> {
    const whereOr: Array<
      { name: { startsWith: string } } | { name: { in: string[] } }
    > = [
      { name: { startsWith: prefix } },
      { name: { startsWith: SELF_PERMISSION_PREFIX } },
      { name: { in: [...GLOBAL_INBOX_PERMISSIONS] } },
    ];

    if (prefix === TENANT_PERMISSION_PREFIX) {
      whereOr.push({
        name: { startsWith: CUSTOMER_OPS_PERMISSION_PREFIX },
      });
    }

    const permissions = await this.prisma.permission.findMany({
      where: { OR: whereOr },
      select: { name: true, description: true },
      orderBy: { name: 'asc' },
    });

    return permissions;
  }

  async syncPermissions(
    scope: RoleManagementScope,
    publicId: string,
    dto: SyncManagedRolePermissionsDto,
    prefix: RolePermissionPrefix,
    auditContext: AuditContext,
  ): Promise<ManagedRoleResponse> {
    const existing = await this.loadManageableRoleRecord(scope, publicId);
    const uniqueNames = [...new Set(dto.permissionNames)];

    const outOfScope = uniqueNames.filter(
      (name) => !isPermissionInScope(name, prefix),
    );

    if (outOfScope.length > 0) {
      throw new BadRequestException(
        'One or more permissions are outside this Role Management scope',
      );
    }

    const dbPermissions = uniqueNames.length
      ? await this.prisma.permission.findMany({
          where: { name: { in: uniqueNames } },
          select: { permissionId: true, name: true },
        })
      : [];

    if (dbPermissions.length !== uniqueNames.length) {
      throw new NotFoundException(
        'One or more provided permission names do not exist',
      );
    }

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({
        where: { roleId: existing.roleId },
      }),
      this.prisma.rolePermission.createMany({
        data: dbPermissions.map((permission) => ({
          roleId: existing.roleId,
          permissionId: permission.permissionId,
        })),
      }),
    ]);

    const updated = await this.prisma.role.findUniqueOrThrow({
      where: { publicId: existing.publicId },
      select: ROLE_SELECT,
    });

    const response = this.toResponse(updated);

    this.emitAudit(scope, auditContext, {
      action: ROLE_MANAGEMENT_AUDIT_ACTIONS.PERMISSIONS_SYNCED,
      targetId: response.publicId,
      payload: { permissionNames: response.permissions },
    });

    return response;
  }

  private scopeTenantId(scope: RoleManagementScope): string | null {
    return scope.kind === 'tenant' ? scope.tenantId : null;
  }

  private assertNotReservedKey(key: string): void {
    if (key === SUPER_ADMIN_ROLE_KEY) {
      throw new BadRequestException(
        'The Super Admin role is reserved by the system',
      );
    }
  }

  private async loadManageableRole(
    scope: RoleManagementScope,
    publicId: string,
  ): Promise<ManagedRoleResponse> {
    const role = await this.loadManageableRoleRecord(scope, publicId);
    return this.toResponse(role);
  }

  private async loadManageableRoleRecord(
    scope: RoleManagementScope,
    publicId: string,
  ): Promise<RoleRecord & { roleId: number }> {
    const role = await this.prisma.role.findFirst({
      where: {
        publicId,
        tenantId: this.scopeTenantId(scope),
      },
      select: {
        ...ROLE_SELECT,
        roleId: true,
      },
    });

    if (!role || role.key === SUPER_ADMIN_ROLE_KEY) {
      throw new NotFoundException('Role not found');
    }

    return role;
  }

  private toResponse(role: RoleRecord): ManagedRoleResponse {
    return {
      publicId: role.publicId,
      key: role.key,
      name: role.name,
      description: role.description,
      permissions: role.rolePermissions.map(
        (mapping) => mapping.permission.name,
      ),
    };
  }

  private emitAudit(
    scope: RoleManagementScope,
    auditContext: AuditContext,
    params: {
      action: string;
      targetId: string;
      payload?: Record<string, unknown>;
    },
  ): void {
    this.auditEmitter.emit({
      ...auditContext,
      tenantId: scope.kind === 'tenant' ? scope.tenantId : null,
      module: scope.kind === 'tenant' ? 'TENANT' : 'PLATFORM',
      targetType: 'Role',
      ...params,
    });
  }
}
