import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
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
  ApiForbiddenResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { extractAuditRequestContext } from '../../../../../core/audit/utils/audit-request-context.util';
import { PERMISSIONS } from '../../../../auth/shared/constants/permissions.constant';
import { Permission } from '../../../../auth/shared/decorators/permission.decorator';
import type { AuthenticatedRequest } from '../../../../auth/shared/guards/permission.guard';
import { resolveCallerTenantId } from '../../../../roles/shared/utils/resolve-caller-tenant.util';
import { UpdateTenantBrandDetailsDto } from '../dto/update-tenant-brand-details.dto';
import {
  TenantBrandDetailsService,
  type TenantBrandDetailsResponse,
  type UpdateTenantBrandDetailsResponse,
} from '../services/tenant-brand-details.service';

@ApiTags('System Configurations - Tenant Brand Details')
@ApiBearerAuth('bearer')
@Controller('tenant/system-configurations/brand')
export class TenantBrandDetailsController {
  constructor(
    private readonly tenantBrandDetailsService: TenantBrandDetailsService,
  ) {}

  @Get()
  @Permission(PERMISSIONS.TENANT.CONFIG_READ)
  @ApiOperation({ summary: "Get brand identity for the caller's tenant" })
  @ApiResponse({ status: 200, description: 'Tenant brand identity' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or no tenant membership',
  })
  getBrandDetails(
    @Req() request: AuthenticatedRequest,
  ): Promise<TenantBrandDetailsResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.tenantBrandDetailsService.getBrandDetails(tenantId);
  }

  @Patch()
  @Permission(PERMISSIONS.TENANT.CONFIG_UPDATE)
  @ApiOperation({
    summary:
      "Update brand name, slogan, and/or brand color for the caller's tenant (not logo)",
  })
  @ApiResponse({ status: 200, description: 'Tenant brand identity updated' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or no tenant membership',
  })
  updateBrandDetails(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateTenantBrandDetailsDto,
  ): Promise<UpdateTenantBrandDetailsResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.tenantBrandDetailsService.updateBrandDetails(
      tenantId,
      dto,
      extractAuditRequestContext(request),
    );
  }

  @Post('logo')
  @Permission(PERMISSIONS.TENANT.CONFIG_UPDATE)
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
  @ApiOperation({
    summary: "Upload or replace the caller's tenant brand logo image",
  })
  @ApiResponse({ status: 201, description: 'Tenant brand logo uploaded' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or no tenant membership',
  })
  uploadLogo(
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
  ): Promise<UpdateTenantBrandDetailsResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.tenantBrandDetailsService.updateLogo(
      tenantId,
      file,
      extractAuditRequestContext(request),
    );
  }
}
