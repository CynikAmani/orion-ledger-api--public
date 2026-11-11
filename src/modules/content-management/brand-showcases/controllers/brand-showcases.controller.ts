import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { extractAuditRequestContext } from '../../../../core/audit/utils/audit-request-context.util';
import { optionalImageFilePipe } from '../../../../core/storage/pipes/optional-image-file.pipe';
import { Permission } from '../../../auth/shared/decorators/permission.decorator';
import { PERMISSIONS } from '../../../auth/shared/constants/permissions.constant';
import type { AuthenticatedRequest } from '../../../auth/shared/guards/permission.guard';
import { resolveCallerTenantId } from '../../../roles/shared/utils/resolve-caller-tenant.util';
import { CreateBrandShowcaseDto } from '../dto/create-brand-showcase.dto';
import { ListBrandShowcasesQueryDto } from '../dto/list-brand-showcases-query.dto';
import { UpdateBrandShowcaseDto } from '../dto/update-brand-showcase.dto';
import {
  BrandShowcasesService,
  type BrandShowcaseResponse,
} from '../services/brand-showcases.service';
import {
  CREATE_BRAND_SHOWCASE_MULTIPART_BODY,
  UPDATE_BRAND_SHOWCASE_MULTIPART_BODY,
} from '../swagger/brand-showcase-multipart.swagger';

@ApiTags('Content Management - Brand Showcases')
@ApiBearerAuth('bearer')
@Controller('content-management/brand-showcases')
export class BrandShowcasesController {
  constructor(
    private readonly brandShowcasesService: BrandShowcasesService,
  ) {}

  @Post()
  @Permission(PERMISSIONS.CONTENT_MANAGEMENT.BRAND_SHOWCASES_CREATE)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  @ApiConsumes('multipart/form-data')
  @ApiBody(CREATE_BRAND_SHOWCASE_MULTIPART_BODY)
  @ApiOperation({
    summary:
      'Create a brand showcase for the caller\'s tenant (optional image in the same request)',
  })
  @ApiResponse({ status: 201, description: 'Brand showcase created' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or tenant membership required',
  })
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateBrandShowcaseDto,
    @UploadedFile(optionalImageFilePipe) file?: Express.Multer.File,
  ): Promise<BrandShowcaseResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.brandShowcasesService.create(
      tenantId,
      dto,
      extractAuditRequestContext(request),
      file,
    );
  }

  @Get()
  @Permission(PERMISSIONS.CONTENT_MANAGEMENT.BRAND_SHOWCASES_READ)
  @ApiOperation({
    summary: 'List brand showcase assets for the caller\'s tenant',
  })
  @ApiResponse({ status: 200, description: 'Brand showcase list' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or tenant membership required',
  })
  findAll(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListBrandShowcasesQueryDto,
  ): Promise<BrandShowcaseResponse[]> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.brandShowcasesService.findAll(tenantId, query);
  }

  @Get(':id')
  @Permission(PERMISSIONS.CONTENT_MANAGEMENT.BRAND_SHOWCASES_READ)
  @ApiOperation({
    summary: 'Get a brand showcase by ID for the caller\'s tenant',
  })
  @ApiResponse({ status: 200, description: 'Brand showcase found' })
  @ApiNotFoundResponse({ description: 'Brand showcase not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or tenant membership required',
  })
  findOne(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<BrandShowcaseResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.brandShowcasesService.findOne(tenantId, id);
  }

  @Patch(':id')
  @Permission(PERMISSIONS.CONTENT_MANAGEMENT.BRAND_SHOWCASES_UPDATE)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  @ApiConsumes('multipart/form-data')
  @ApiBody(UPDATE_BRAND_SHOWCASE_MULTIPART_BODY)
  @ApiOperation({
    summary:
      'Update a brand showcase for the caller\'s tenant (optional image replacement in the same request)',
  })
  @ApiResponse({ status: 200, description: 'Brand showcase updated' })
  @ApiNotFoundResponse({ description: 'Brand showcase not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or tenant membership required',
  })
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBrandShowcaseDto,
    @UploadedFile(optionalImageFilePipe) file?: Express.Multer.File,
  ): Promise<BrandShowcaseResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.brandShowcasesService.update(
      tenantId,
      id,
      dto,
      extractAuditRequestContext(request),
      file,
    );
  }

  @Delete(':id')
  @Permission(PERMISSIONS.CONTENT_MANAGEMENT.BRAND_SHOWCASES_DELETE)
  @ApiOperation({
    summary: 'Delete a brand showcase asset for the caller\'s tenant',
  })
  @ApiResponse({ status: 200, description: 'Brand showcase deleted' })
  @ApiNotFoundResponse({ description: 'Brand showcase not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or tenant membership required',
  })
  async remove(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string }> {
    const tenantId = resolveCallerTenantId(request.user);
    await this.brandShowcasesService.remove(
      tenantId,
      id,
      extractAuditRequestContext(request),
    );
    return { message: 'Brand showcase deleted successfully' };
  }
}
