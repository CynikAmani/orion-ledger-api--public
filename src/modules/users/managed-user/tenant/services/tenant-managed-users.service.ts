import { Injectable } from '@nestjs/common';
import type { AuditContext } from '../../../../../core/audit/interfaces/audit-payload.interface';
import type { AuthenticatedUser } from '../../../../auth/shared/types/authenticated-user.type';
import { resolveCallerTenantId } from '../../../../roles/shared/utils/resolve-caller-tenant.util';
import { AssignManagedUserRolesDto } from '../../shared/dto/assign-managed-user-roles.dto';
import { CreateManagedUserDto } from '../../shared/dto/create-managed-user.dto';
import { ListManagedUsersQueryDto } from '../../shared/dto/list-managed-users-query.dto';
import { SetUserBlockStatusDto } from '../../shared/dto/set-user-block-status.dto';
import { UpdateManagedUserDto } from '../../shared/dto/update-managed-user.dto';
import {
  UserManagementService,
  type ManagedUserDetail,
  type PaginatedManagedUsersResponse,
  type UserManagementScope,
} from '../../shared/services/user-management.service';

@Injectable()
export class TenantManagedUsersService {
  constructor(private readonly userManagement: UserManagementService) {}

  findAll(
    user: AuthenticatedUser,
    query: ListManagedUsersQueryDto,
  ): Promise<PaginatedManagedUsersResponse> {
    return this.userManagement.findAll(
      this.scopeFor(user),
      query,
      user.id,
    );
  }

  findOne(user: AuthenticatedUser, userId: string): Promise<ManagedUserDetail> {
    return this.userManagement.findOne(this.scopeFor(user), userId, user.id);
  }

  create(
    user: AuthenticatedUser,
    dto: CreateManagedUserDto,
    auditContext: AuditContext,
    frontendOrigin: string,
  ): Promise<ManagedUserDetail> {
    return this.userManagement.create(
      this.scopeFor(user),
      dto,
      auditContext,
      frontendOrigin,
    );
  }

  triggerRecovery(
    user: AuthenticatedUser,
    userId: string,
    auditContext: AuditContext,
    frontendOrigin: string,
  ): Promise<{ message: string }> {
    return this.userManagement.triggerRecovery(
      this.scopeFor(user),
      userId,
      auditContext,
      frontendOrigin,
    );
  }

  update(
    user: AuthenticatedUser,
    userId: string,
    dto: UpdateManagedUserDto,
    auditContext: AuditContext,
  ): Promise<ManagedUserDetail> {
    return this.userManagement.update(
      this.scopeFor(user),
      userId,
      dto,
      auditContext,
    );
  }

  updateRoles(
    user: AuthenticatedUser,
    userId: string,
    dto: AssignManagedUserRolesDto,
    auditContext: AuditContext,
  ): Promise<ManagedUserDetail> {
    return this.userManagement.updateRoles(
      this.scopeFor(user),
      userId,
      dto,
      auditContext,
    );
  }

  updateAvatar(
    user: AuthenticatedUser,
    userId: string,
    file: Express.Multer.File,
    auditContext: AuditContext,
  ): Promise<ManagedUserDetail> {
    return this.userManagement.updateAvatar(
      this.scopeFor(user),
      userId,
      file,
      auditContext,
    );
  }

  setBlockStatus(
    user: AuthenticatedUser,
    userId: string,
    dto: SetUserBlockStatusDto,
    auditContext: AuditContext,
  ): Promise<ManagedUserDetail> {
    return this.userManagement.setBlockStatus(
      this.scopeFor(user),
      userId,
      dto,
      auditContext,
    );
  }

  terminateSessions(
    user: AuthenticatedUser,
    userId: string,
    auditContext: AuditContext,
  ): Promise<{ message: string }> {
    return this.userManagement.terminateSessions(
      this.scopeFor(user),
      userId,
      auditContext,
    );
  }

  softDelete(
    user: AuthenticatedUser,
    userId: string,
    auditContext: AuditContext,
  ): Promise<{ message: string }> {
    return this.userManagement.softDelete(
      this.scopeFor(user),
      userId,
      auditContext,
    );
  }

  undeleteUserAccount(
    user: AuthenticatedUser,
    userId: string,
    auditContext: AuditContext,
  ): Promise<ManagedUserDetail> {
    return this.userManagement.undeleteUserAccount(
      this.scopeFor(user),
      userId,
      auditContext,
    );
  }

  private scopeFor(user: AuthenticatedUser): UserManagementScope {
    return {
      kind: 'tenant',
      tenantId: resolveCallerTenantId(user),
    };
  }
}
