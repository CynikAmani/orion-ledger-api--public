import { Injectable } from '@nestjs/common';
import type { AuditContext } from '../../../../../core/audit/interfaces/audit-payload.interface';
import { AssignManagedUserRolesDto } from '../../shared/dto/assign-managed-user-roles.dto';
import { CreateManagedUserDto } from '../../shared/dto/create-managed-user.dto';
import { ListManagedUsersQueryDto } from '../../shared/dto/list-managed-users-query.dto';
import { SetUserBlockStatusDto } from '../../shared/dto/set-user-block-status.dto';
import { UpdateManagedUserDto } from '../../shared/dto/update-managed-user.dto';
import {
  UserManagementService,
  type ManagedUserDetail,
  type PaginatedManagedUsersResponse,
} from '../../shared/services/user-management.service';

const PLATFORM_SCOPE = { kind: 'platform' as const };

@Injectable()
export class PlatformManagedUsersService {
  constructor(private readonly userManagement: UserManagementService) {}

  findAll(
    query: ListManagedUsersQueryDto,
    callerUserId: number,
  ): Promise<PaginatedManagedUsersResponse> {
    return this.userManagement.findAll(PLATFORM_SCOPE, query, callerUserId);
  }

  findOne(userId: string, callerUserId: number): Promise<ManagedUserDetail> {
    return this.userManagement.findOne(PLATFORM_SCOPE, userId, callerUserId);
  }

  create(
    dto: CreateManagedUserDto,
    auditContext: AuditContext,
    frontendOrigin: string,
  ): Promise<ManagedUserDetail> {
    return this.userManagement.create(
      PLATFORM_SCOPE,
      dto,
      auditContext,
      frontendOrigin,
    );
  }

  triggerRecovery(
    userId: string,
    auditContext: AuditContext,
    frontendOrigin: string,
  ): Promise<{ message: string }> {
    return this.userManagement.triggerRecovery(
      PLATFORM_SCOPE,
      userId,
      auditContext,
      frontendOrigin,
    );
  }

  update(
    userId: string,
    dto: UpdateManagedUserDto,
    auditContext: AuditContext,
  ): Promise<ManagedUserDetail> {
    return this.userManagement.update(
      PLATFORM_SCOPE,
      userId,
      dto,
      auditContext,
    );
  }

  updateRoles(
    userId: string,
    dto: AssignManagedUserRolesDto,
    auditContext: AuditContext,
  ): Promise<ManagedUserDetail> {
    return this.userManagement.updateRoles(
      PLATFORM_SCOPE,
      userId,
      dto,
      auditContext,
    );
  }

  updateAvatar(
    userId: string,
    file: Express.Multer.File,
    auditContext: AuditContext,
  ): Promise<ManagedUserDetail> {
    return this.userManagement.updateAvatar(
      PLATFORM_SCOPE,
      userId,
      file,
      auditContext,
    );
  }

  setBlockStatus(
    userId: string,
    dto: SetUserBlockStatusDto,
    auditContext: AuditContext,
  ): Promise<ManagedUserDetail> {
    return this.userManagement.setBlockStatus(
      PLATFORM_SCOPE,
      userId,
      dto,
      auditContext,
    );
  }

  terminateSessions(
    userId: string,
    auditContext: AuditContext,
  ): Promise<{ message: string }> {
    return this.userManagement.terminateSessions(
      PLATFORM_SCOPE,
      userId,
      auditContext,
    );
  }

  softDelete(
    userId: string,
    auditContext: AuditContext,
  ): Promise<{ message: string }> {
    return this.userManagement.softDelete(PLATFORM_SCOPE, userId, auditContext);
  }

  undeleteUserAccount(
    userId: string,
    auditContext: AuditContext,
  ): Promise<ManagedUserDetail> {
    return this.userManagement.undeleteUserAccount(
      PLATFORM_SCOPE,
      userId,
      auditContext,
    );
  }
}
