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
import { PlatformManagedUsersService } from '../services/platform-managed-users.service';

@ApiTags('User Management - Platform')
@ApiBearerAuth('bearer')
@Controller('platform/users')
export class PlatformManagedUsersController {
  constructor(
    private readonly platformManagedUsersService: PlatformManagedUsersService,
    private readonly managedUserIdentityDocumentsService: ManagedUserIdentityDocumentsService,
    private readonly requestOriginService: RequestOriginService,
  ) {}

  @Get()
  @Permission(PERMISSIONS.PLATFORM.USERS_READ)
  @ApiOperation({
    summary: 'List platform users (no tenant membership)',
  })
  @ApiResponse({ status: 200, description: 'Paginated platform user list' })
  findAll(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListManagedUsersQueryDto,
  ): Promise<PaginatedManagedUsersResponse> {
    return this.platformManagedUsersService.findAll(
      query,
      request.user.id,
    );
  }

  @Get(':userId')
  @Permission(PERMISSIONS.PLATFORM.USERS_READ)
  @ApiOperation({
    summary:
      'Get a platform user by userId (tenant members are not visible here)',
  })
  @ApiResponse({
    status: 200,
    description: 'Platform user detail (tenantId is always null)',
  })
  @ApiNotFoundResponse({ description: 'User not found' })
  findOne(
    @Req() request: AuthenticatedRequest,
    @Param('userId') userId: string,
  ): Promise<ManagedUserDetail> {
    return this.platformManagedUsersService.findOne(userId, request.user.id);
  }

  @Get(':userId/identity-document')
  @Permission(PERMISSIONS.PLATFORM.USERS_READ)
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    summary:
      'Get identity document and signature for a platform User Management user',
  })
  @ApiResponse({
    status: 200,
    description:
      'Identity document and signature (null data URLs when a file is missing)',
  })
  @ApiNotFoundResponse({
    description: 'User not found in the platform User Management catalog',
  })
  getIdentityDocument(
    @Param('userId') userId: string,
  ): Promise<IdentityDocumentResponse> {
    return this.managedUserIdentityDocumentsService.getManagedUserIdentityDocument(
      userId,
      { kind: 'platform' },
    );
  }

  @Post()
  @Permission(PERMISSIONS.PLATFORM.USERS_CREATE)
  @ApiOperation({
    summary:
      'Provision a platform user and send an invitation email when email is provided',
  })
  @ApiResponse({ status: 201, description: 'User provisioned' })
  @ApiConflictResponse({
    description: 'Username, email, or national ID in use',
  })
  create(
    @Req() request: AuthenticatedRequest,
    @Body() createDto: CreateManagedUserDto,
  ): Promise<ManagedUserDetail> {
    return this.platformManagedUsersService.create(
      createDto,
      extractAuditRequestContext(request),
      this.requestOriginService.resolve(request),
    );
  }

  @Post(':userId/recovery')
  @Permission(PERMISSIONS.PLATFORM.USERS_UPDATE)
  @ApiOperation({ summary: 'Force account recovery for a platform user' })
  @ApiResponse({ status: 200, description: 'Recovery initiated' })
  triggerRecovery(
    @Req() request: AuthenticatedRequest,
    @Param('userId') userId: string,
  ): Promise<{ message: string }> {
    return this.platformManagedUsersService.triggerRecovery(
      userId,
      extractAuditRequestContext(request),
      this.requestOriginService.resolve(request),
    );
  }

  @Patch(':userId')
  @Permission(PERMISSIONS.PLATFORM.USERS_UPDATE)
  @ApiOperation({ summary: 'Update platform user profile details' })
  @ApiResponse({ status: 200, description: 'Platform user updated' })
  update(
    @Req() request: AuthenticatedRequest,
    @Param('userId') userId: string,
    @Body() updateDto: UpdateManagedUserDto,
  ): Promise<ManagedUserDetail> {
    return this.platformManagedUsersService.update(
      userId,
      updateDto,
      extractAuditRequestContext(request),
    );
  }

  @Patch(':userId/roles')
  @Permission(PERMISSIONS.PLATFORM.USERS_ASSIGN_ROLES)
  @ApiOperation({ summary: 'Replace platform role assignments' })
  @ApiResponse({ status: 200, description: 'Roles updated' })
  updateRoles(
    @Req() request: AuthenticatedRequest,
    @Param('userId') userId: string,
    @Body() assignRolesDto: AssignManagedUserRolesDto,
  ): Promise<ManagedUserDetail> {
    return this.platformManagedUsersService.updateRoles(
      userId,
      assignRolesDto,
      extractAuditRequestContext(request),
    );
  }

  @Post(':userId/avatar')
  @Permission(PERMISSIONS.PLATFORM.USERS_UPDATE)
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
  @ApiOperation({ summary: 'Upload or override a platform user avatar' })
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
    return this.platformManagedUsersService.updateAvatar(
      userId,
      file,
      extractAuditRequestContext(request),
    );
  }

  @Patch(':userId/block')
  @Permission(PERMISSIONS.PLATFORM.USERS_BLOCK)
  @ApiOperation({
    summary: 'Toggle operational hold (loans/approvals). Does not lock login.',
  })
  @ApiResponse({ status: 200, description: 'Block status updated' })
  setBlockStatus(
    @Req() request: AuthenticatedRequest,
    @Param('userId') userId: string,
    @Body() blockDto: SetUserBlockStatusDto,
  ): Promise<ManagedUserDetail> {
    return this.platformManagedUsersService.setBlockStatus(
      userId,
      blockDto,
      extractAuditRequestContext(request),
    );
  }

  @Post(':userId/terminate-sessions')
  @Permission(PERMISSIONS.PLATFORM.USERS_BLOCK)
  @ApiOperation({
    summary: 'Terminate all active sessions for a platform user',
  })
  @ApiResponse({ status: 200, description: 'Sessions terminated' })
  terminateSessions(
    @Req() request: AuthenticatedRequest,
    @Param('userId') userId: string,
  ): Promise<{ message: string }> {
    return this.platformManagedUsersService.terminateSessions(
      userId,
      extractAuditRequestContext(request),
    );
  }

  @Post(':userId/restore')
  @Permission(PERMISSIONS.PLATFORM.USERS_UPDATE)
  @ApiOperation({ summary: 'Restore a soft-deleted platform user account' })
  @ApiResponse({ status: 200, description: 'Account restored' })
  undeleteUserAccount(
    @Req() request: AuthenticatedRequest,
    @Param('userId') userId: string,
  ): Promise<ManagedUserDetail> {
    return this.platformManagedUsersService.undeleteUserAccount(
      userId,
      extractAuditRequestContext(request),
    );
  }

  @Delete(':userId')
  @Permission(PERMISSIONS.PLATFORM.USERS_DELETE)
  @ApiOperation({
    summary:
      'Soft-delete a platform user (revokes account access until restore)',
  })
  @ApiResponse({ status: 200, description: 'User soft-deleted' })
  softDelete(
    @Req() request: AuthenticatedRequest,
    @Param('userId') userId: string,
  ): Promise<{ message: string }> {
    return this.platformManagedUsersService.softDelete(
      userId,
      extractAuditRequestContext(request),
    );
  }
}
