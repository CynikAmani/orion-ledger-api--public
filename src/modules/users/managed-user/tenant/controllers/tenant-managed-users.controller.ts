import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  FileTypeValidator,
  MaxFileSizeValidator,
  ParseFilePipe,
} from '@nestjs/common/pipes';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { extractAuditRequestContext } from '../../../../../core/audit/utils/audit-request-context.util';
import { RequestOriginService } from '../../../../../core/config/request-origin.service';
import { Permission } from '../../../../auth/shared/decorators/permission.decorator';
import { PERMISSIONS } from '../../../../auth/shared/constants/permissions.constant';
import type { AuthenticatedRequest } from '../../../../auth/shared/guards/permission.guard';
import { resolveCallerTenantId } from '../../../../roles/shared/utils/resolve-caller-tenant.util';
import type { IdentityDocumentResponse } from '../../../shared/services/identity-document-storage.service';
import { AssignManagedUserRolesDto } from '../../shared/dto/assign-managed-user-roles.dto';
import { CreateManagedUserDto } from '../../shared/dto/create-managed-user.dto';
import { ListManagedUsersQueryDto } from '../../shared/dto/list-managed-users-query.dto';
import { SetUserBlockStatusDto } from '../../shared/dto/set-user-block-status.dto';
import { UpdateManagedUserDto } from '../../shared/dto/update-managed-user.dto';
import { ManagedUserIdentityDocumentsService } from '../../shared/services/managed-user-identity-documents.service';
import type {
  ManagedUserDetail,
  PaginatedManagedUsersResponse,
} from '../../shared/services/user-management.service';
import { TenantManagedUsersService } from '../services/tenant-managed-users.service';

@ApiTags('User Management - Tenant')
@ApiBearerAuth('bearer')
@Controller('tenant/users')
export class TenantManagedUsersController {
  constructor(
    private readonly tenantManagedUsersService: TenantManagedUsersService,
    private readonly managedUserIdentityDocumentsService: ManagedUserIdentityDocumentsService,
    private readonly requestOriginService: RequestOriginService,
  ) {}

  @Get()
  @Permission(PERMISSIONS.TENANT.USERS_READ)
  @ApiOperation({
    summary: "List users in the caller's tenant (User.tenantId)",
  })
  @ApiResponse({ status: 200, description: 'Paginated tenant user list' })
  findAll(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListManagedUsersQueryDto,
  ): Promise<PaginatedManagedUsersResponse> {
    return this.tenantManagedUsersService.findAll(request.user, query);
  }

  @Get(':userId')
  @Permission(PERMISSIONS.TENANT.USERS_READ)
  @ApiOperation({ summary: 'Get a tenant user by userId' })
  @ApiResponse({ status: 200, description: 'Tenant user detail' })
  @ApiNotFoundResponse({ description: 'User not found' })
  findOne(
    @Req() request: AuthenticatedRequest,
    @Param('userId') userId: string,
  ): Promise<ManagedUserDetail> {
    return this.tenantManagedUsersService.findOne(request.user, userId);
  }

  @Get(':userId/identity-document')
  @Permission(PERMISSIONS.TENANT.USERS_READ)
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    summary:
      "Get a tenant member identity document and signature (caller's membership)",
  })
  @ApiResponse({
    status: 200,
    description:
      'Identity document and signature (null data URLs when a file is missing)',
  })
  @ApiNotFoundResponse({
    description: "User not in the caller's tenant catalog",
  })
  getIdentityDocument(
    @Req() request: AuthenticatedRequest,
    @Param('userId') userId: string,
  ): Promise<IdentityDocumentResponse> {
    return this.managedUserIdentityDocumentsService.getManagedUserIdentityDocument(
      userId,
      {
        kind: 'tenant',
        tenantId: resolveCallerTenantId(request.user),
      },
    );
  }

  @Post()
  @Permission(PERMISSIONS.TENANT.USERS_CREATE)
  @ApiOperation({
    summary:
      'Provision a tenant user (User.tenantId = caller tenant) and send an invitation when email is provided',
  })
  @ApiResponse({ status: 201, description: 'User provisioned' })
  @ApiConflictResponse({
    description: 'Username, email, or national ID in use',
  })
  create(
    @Req() request: AuthenticatedRequest,
    @Body() createDto: CreateManagedUserDto,
  ): Promise<ManagedUserDetail> {
    return this.tenantManagedUsersService.create(
      request.user,
      createDto,
      extractAuditRequestContext(request),
      this.requestOriginService.resolve(request),
    );
  }

  @Post(':userId/recovery')
  @Permission(PERMISSIONS.TENANT.USERS_UPDATE)
  @ApiOperation({ summary: 'Force account recovery for a tenant user' })
  @ApiResponse({ status: 200, description: 'Recovery initiated' })
  triggerRecovery(
    @Req() request: AuthenticatedRequest,
    @Param('userId') userId: string,
  ): Promise<{ message: string }> {
    return this.tenantManagedUsersService.triggerRecovery(
      request.user,
      userId,
      extractAuditRequestContext(request),
      this.requestOriginService.resolve(request),
    );
  }

  @Patch(':userId')
  @Permission(PERMISSIONS.TENANT.USERS_UPDATE)
  @ApiOperation({ summary: 'Update tenant user profile details' })
  @ApiResponse({ status: 200, description: 'Tenant user updated' })
  update(
    @Req() request: AuthenticatedRequest,
    @Param('userId') userId: string,
    @Body() updateDto: UpdateManagedUserDto,
  ): Promise<ManagedUserDetail> {
    return this.tenantManagedUsersService.update(
      request.user,
      userId,
      updateDto,
      extractAuditRequestContext(request),
    );
  }

  @Patch(':userId/roles')
  @Permission(PERMISSIONS.TENANT.USERS_ASSIGN_ROLES)
  @ApiOperation({ summary: 'Replace tenant role assignments for this tenant' })
  @ApiResponse({ status: 200, description: 'Roles updated' })
  updateRoles(
    @Req() request: AuthenticatedRequest,
    @Param('userId') userId: string,
    @Body() assignRolesDto: AssignManagedUserRolesDto,
  ): Promise<ManagedUserDetail> {
    return this.tenantManagedUsersService.updateRoles(
      request.user,
      userId,
      assignRolesDto,
      extractAuditRequestContext(request),
    );
  }

  @Post(':userId/avatar')
  @Permission(PERMISSIONS.TENANT.USERS_UPDATE)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @ApiOperation({ summary: 'Upload or override a tenant user avatar' })
  @ApiResponse({ status: 201, description: 'Avatar updated' })
  uploadAvatar(
    @Req() request: AuthenticatedRequest,
    @Param('userId') userId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({
            fileType: /^image\/(jpeg|png|webp|gif)$/,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
  ): Promise<ManagedUserDetail> {
    return this.tenantManagedUsersService.updateAvatar(
      request.user,
      userId,
      file,
      extractAuditRequestContext(request),
    );
  }

  @Patch(':userId/block')
  @Permission(PERMISSIONS.TENANT.USERS_BLOCK)
  @ApiOperation({
    summary: 'Toggle operational hold (loans/approvals). Does not lock login.',
  })
  @ApiResponse({ status: 200, description: 'Block status updated' })
  setBlockStatus(
    @Req() request: AuthenticatedRequest,
    @Param('userId') userId: string,
    @Body() blockDto: SetUserBlockStatusDto,
  ): Promise<ManagedUserDetail> {
    return this.tenantManagedUsersService.setBlockStatus(
      request.user,
      userId,
      blockDto,
      extractAuditRequestContext(request),
    );
  }

  @Post(':userId/terminate-sessions')
  @Permission(PERMISSIONS.TENANT.USERS_BLOCK)
  @ApiOperation({ summary: 'Terminate all active sessions for a tenant user' })
  @ApiResponse({ status: 200, description: 'Sessions terminated' })
  terminateSessions(
    @Req() request: AuthenticatedRequest,
    @Param('userId') userId: string,
  ): Promise<{ message: string }> {
    return this.tenantManagedUsersService.terminateSessions(
      request.user,
      userId,
      extractAuditRequestContext(request),
    );
  }

  @Post(':userId/restore')
  @Permission(PERMISSIONS.TENANT.USERS_UPDATE)
  @ApiOperation({ summary: 'Restore a soft-deleted tenant user account' })
  @ApiResponse({ status: 200, description: 'Account restored' })
  undeleteUserAccount(
    @Req() request: AuthenticatedRequest,
    @Param('userId') userId: string,
  ): Promise<ManagedUserDetail> {
    return this.tenantManagedUsersService.undeleteUserAccount(
      request.user,
      userId,
      extractAuditRequestContext(request),
    );
  }

  @Delete(':userId')
  @Permission(PERMISSIONS.TENANT.USERS_DELETE)
  @ApiOperation({
    summary: 'Soft-delete a tenant user (revokes account access until restore)',
  })
  @ApiResponse({ status: 200, description: 'User soft-deleted' })
  softDelete(
    @Req() request: AuthenticatedRequest,
    @Param('userId') userId: string,
  ): Promise<{ message: string }> {
    return this.tenantManagedUsersService.softDelete(
      request.user,
      userId,
      extractAuditRequestContext(request),
    );
  }
}
