import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Patch,
  Post,
  Put,
  Req,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import {
  FileTypeValidator,
  MaxFileSizeValidator,
  ParseFilePipe,
} from '@nestjs/common/pipes';
import {
  FileFieldsInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { extractAuditRequestContext } from '../../../../core/audit/utils/audit-request-context.util';
import { AllowExpiredSubscription } from '../../../auth/shared/decorators/allow-expired-subscription.decorator';
import { Permission } from '../../../auth/shared/decorators/permission.decorator';
import { PERMISSIONS } from '../../../auth/shared/constants/permissions.constant';
import type { AuthenticatedRequest } from '../../../auth/shared/guards/permission.guard';
import type { IdentityDocumentResponse } from '../../shared/services/identity-document-storage.service';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { UpdateMfaPreferenceDto } from '../dto/update-mfa-preference.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { MeIdentityDocumentService } from '../services/me-identity-document.service';
import {
  MeProfile,
  MeService,
  type UpdateMfaPreferenceResponse,
} from '../services/me.service';
import { UPSERT_MY_IDENTITY_DOCUMENT_MULTIPART_BODY } from '../swagger/identity-document-multipart.swagger';

type IdentityDocumentUploadFields = {
  identityDocument?: Express.Multer.File[];
  signature?: Express.Multer.File[];
};

@ApiTags('Me')
@ApiBearerAuth('bearer')
@AllowExpiredSubscription()
@Controller('me')
export class MeController {
  constructor(
    private readonly meService: MeService,
    private readonly meIdentityDocumentService: MeIdentityDocumentService,
  ) {}

  @Get()
  @Permission(PERMISSIONS.SELF.READ)
  @ApiOperation({ summary: 'Get the authenticated user profile' })
  @ApiResponse({ status: 200, description: 'Current user profile' })
  getProfile(@Req() request: AuthenticatedRequest): Promise<MeProfile> {
    return this.meService.getProfile(request.user.id);
  }

  @Patch('profile')
  @Permission(PERMISSIONS.SELF.UPDATE)
  @ApiOperation({
    summary:
      'Update personal profile details (fullname, email, phone, nationalId, gender, district)',
  })
  @ApiResponse({ status: 200, description: 'Updated user profile' })
  updateProfile(
    @Req() request: AuthenticatedRequest,
    @Body() updateProfileDto: UpdateProfileDto,
  ): Promise<MeProfile> {
    return this.meService.updateProfile(
      request.user.id,
      updateProfileDto,
      extractAuditRequestContext(request),
      request.user.tenantId,
    );
  }

  @Patch('password')
  @Permission(PERMISSIONS.SELF.UPDATE)
  @ApiOperation({
    summary:
      'Set or change the authenticated user password (current password required only when one is already set)',
  })
  @ApiResponse({ status: 200, description: 'Password updated successfully' })
  @ApiBadRequestResponse({
    description:
      'Current password is incorrect (errorCode: ERR_INVALID_CURRENT_PASSWORD)',
  })
  changePassword(
    @Req() request: AuthenticatedRequest,
    @Body() changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    return this.meService.changePassword(
      request.user.id,
      changePasswordDto,
      extractAuditRequestContext(request),
      request.user.tenantId,
    );
  }

  @Patch('mfa')
  @Permission(PERMISSIONS.SELF.UPDATE)
  @ApiOperation({
    summary: 'Enable or disable personal email sign-in verification',
  })
  @ApiResponse({ status: 200, description: 'MFA preference updated' })
  @ApiBadRequestResponse({
    description: 'Email is required before enabling sign-in verification',
  })
  @ApiForbiddenResponse({
    description: 'The system root account cannot use personal sign-in verification',
  })
  updateMfaPreference(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateMfaPreferenceDto,
  ): Promise<UpdateMfaPreferenceResponse> {
    return this.meService.updateMfaPreference(
      request.user.id,
      dto,
      extractAuditRequestContext(request),
      request.user.tenantId,
    );
  }

  @Post('avatar')
  @Permission(PERMISSIONS.SELF.UPDATE)
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
        file: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['file'],
    },
  })
  @ApiOperation({ summary: 'Upload a profile avatar image' })
  @ApiResponse({ status: 201, description: 'Avatar uploaded successfully' })
  uploadAvatar(
    @Req() request: AuthenticatedRequest,
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
  ): Promise<MeProfile> {
    return this.meService.updateAvatar(
      request.user.id,
      file,
      extractAuditRequestContext(request),
      request.user.tenantId,
    );
  }

  @Get('identity-document')
  @Permission(PERMISSIONS.SELF.READ)
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    summary: 'Get own identity document and signature',
  })
  @ApiResponse({
    status: 200,
    description:
      'Own identity document and signature (null data URLs when not uploaded yet)',
  })
  getIdentityDocument(
    @Req() request: AuthenticatedRequest,
  ): Promise<IdentityDocumentResponse> {
    return this.meIdentityDocumentService.getMine(request.user.id);
  }

  @Put('identity-document')
  @Permission(PERMISSIONS.SELF.UPDATE)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'identityDocument', maxCount: 1 },
        { name: 'signature', maxCount: 1 },
      ],
      { storage: memoryStorage() },
    ),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody(UPSERT_MY_IDENTITY_DOCUMENT_MULTIPART_BODY)
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    summary:
      'Upload or replace own identity document and/or signature (at least one file required)',
  })
  @ApiResponse({
    status: 200,
    description: 'Identity document and/or signature saved',
  })
  upsertIdentityDocument(
    @Req() request: AuthenticatedRequest,
    @UploadedFiles() files: IdentityDocumentUploadFields,
  ): Promise<IdentityDocumentResponse> {
    return this.meIdentityDocumentService.upsertMine(
      request.user.id,
      {
        identityDocument: files?.identityDocument?.[0],
        signature: files?.signature?.[0],
      },
      extractAuditRequestContext(request),
      request.user.tenantId,
    );
  }

  @Delete()
  @Permission(PERMISSIONS.SELF.DELETE)
  @ApiOperation({ summary: 'Soft-delete the authenticated user account' })
  @ApiResponse({ status: 200, description: 'Account deleted successfully' })
  softDelete(
    @Req() request: AuthenticatedRequest,
  ): Promise<{ message: string }> {
    return this.meService.softDelete(
      request.user.id,
      extractAuditRequestContext(request),
      request.user.tenantId,
    );
  }
}
