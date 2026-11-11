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
import { Permission } from '../../../../auth/shared/decorators/permission.decorator';
import { PERMISSIONS } from '../../../../auth/shared/constants/permissions.constant';
import type { AuthenticatedRequest } from '../../../../auth/shared/guards/permission.guard';
import { UpdateBrandDetailsDto } from '../dto/update-brand-details.dto';
import {
  BrandDetailsService,
  type BrandDetailsResponse,
  type UpdateBrandDetailsResponse,
} from '../services/brand-details.service';

@ApiTags('Brand Details')
@ApiBearerAuth('bearer')
@Controller('system-configurations/brand')
export class BrandDetailsController {
  constructor(private readonly brandDetailsService: BrandDetailsService) {}

  @Get()
  @Permission(PERMISSIONS.SYSTEM_CONFIGURATIONS.READ)
  @ApiOperation({ summary: 'Get global brand details' })
  @ApiResponse({ status: 200, description: 'Current brand details' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  getBrandDetails(): Promise<BrandDetailsResponse> {
    return this.brandDetailsService.getBrandDetails();
  }

  @Patch()
  @Permission(PERMISSIONS.SYSTEM_CONFIGURATIONS.MANAGE)
  @ApiOperation({ summary: 'Update global brand text details' })
  @ApiResponse({ status: 200, description: 'Brand details updated' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  updateBrandDetails(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateBrandDetailsDto,
  ): Promise<UpdateBrandDetailsResponse> {
    return this.brandDetailsService.updateBrandDetails(
      dto,
      extractAuditRequestContext(request),
    );
  }

  @Post('logo')
  @Permission(PERMISSIONS.SYSTEM_CONFIGURATIONS.MANAGE)
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
  @ApiOperation({ summary: 'Upload or replace the global brand logo image' })
  @ApiResponse({ status: 201, description: 'Brand logo uploaded successfully' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
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
  ): Promise<UpdateBrandDetailsResponse> {
    return this.brandDetailsService.updateLogo(
      file,
      extractAuditRequestContext(request),
    );
  }
}
