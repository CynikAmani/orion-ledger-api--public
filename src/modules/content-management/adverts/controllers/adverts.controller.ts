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
import { CreateAdvertDto } from '../dto/create-advert.dto';
import { ListAdvertsQueryDto } from '../dto/list-adverts-query.dto';
import { UpdateAdvertDto } from '../dto/update-advert.dto';
import { UpdateAdvertStatusDto } from '../dto/update-advert-status.dto';
import {
  AdvertsService,
  type AdvertResponse,
} from '../services/adverts.service';
import {
  CREATE_ADVERT_MULTIPART_BODY,
  UPDATE_ADVERT_MULTIPART_BODY,
} from '../swagger/advert-multipart.swagger';

@ApiTags('Content Management - Adverts')
@ApiBearerAuth('bearer')
@Controller('content-management/adverts')
export class AdvertsController {
  constructor(private readonly advertsService: AdvertsService) {}

  @Post()
  @Permission(PERMISSIONS.CONTENT_MANAGEMENT.ADVERTS_CREATE)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  @ApiConsumes('multipart/form-data')
  @ApiBody(CREATE_ADVERT_MULTIPART_BODY)
  @ApiOperation({
    summary: 'Create an advert for the caller\'s tenant (optional image in the same request)',
  })
  @ApiResponse({ status: 201, description: 'Advert created' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or tenant membership required',
  })
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateAdvertDto,
    @UploadedFile(optionalImageFilePipe) file?: Express.Multer.File,
  ): Promise<AdvertResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.advertsService.create(
      tenantId,
      dto,
      extractAuditRequestContext(request),
      file,
    );
  }

  @Get()
  @Permission(PERMISSIONS.CONTENT_MANAGEMENT.ADVERTS_READ)
  @ApiOperation({ summary: 'List adverts for the caller\'s tenant' })
  @ApiResponse({ status: 200, description: 'Advert list' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or tenant membership required',
  })
  findAll(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListAdvertsQueryDto,
  ): Promise<AdvertResponse[]> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.advertsService.findAll(tenantId, query);
  }

  @Get(':id')
  @Permission(PERMISSIONS.CONTENT_MANAGEMENT.ADVERTS_READ)
  @ApiOperation({ summary: 'Get an advert by ID for the caller\'s tenant' })
  @ApiResponse({ status: 200, description: 'Advert found' })
  @ApiNotFoundResponse({ description: 'Advert not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or tenant membership required',
  })
  findOne(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<AdvertResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.advertsService.findOne(tenantId, id);
  }

  @Patch(':id')
  @Permission(PERMISSIONS.CONTENT_MANAGEMENT.ADVERTS_UPDATE)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  @ApiConsumes('multipart/form-data')
  @ApiBody(UPDATE_ADVERT_MULTIPART_BODY)
  @ApiOperation({
    summary:
      'Update advert content fields for the caller\'s tenant (optional image replacement). Status transitions use PATCH :id/status.',
  })
  @ApiResponse({ status: 200, description: 'Advert updated' })
  @ApiNotFoundResponse({ description: 'Advert not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or tenant membership required',
  })
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAdvertDto,
    @UploadedFile(optionalImageFilePipe) file?: Express.Multer.File,
  ): Promise<AdvertResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.advertsService.update(
      tenantId,
      id,
      dto,
      extractAuditRequestContext(request),
      file,
    );
  }

  @Patch(':id/status')
  @Permission(PERMISSIONS.CONTENT_MANAGEMENT.ADVERTS_UPDATE)
  @ApiOperation({
    summary: 'Transition advert lifecycle status for the caller\'s tenant',
  })
  @ApiResponse({ status: 200, description: 'Advert status updated' })
  @ApiNotFoundResponse({ description: 'Advert not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or tenant membership required',
  })
  updateStatus(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAdvertStatusDto,
  ): Promise<AdvertResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.advertsService.updateStatus(
      tenantId,
      id,
      dto,
      extractAuditRequestContext(request),
    );
  }

  @Delete(':id')
  @Permission(PERMISSIONS.CONTENT_MANAGEMENT.ADVERTS_DELETE)
  @ApiOperation({ summary: 'Delete an advert for the caller\'s tenant' })
  @ApiResponse({ status: 200, description: 'Advert deleted' })
  @ApiNotFoundResponse({ description: 'Advert not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or tenant membership required',
  })
  async remove(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string }> {
    const tenantId = resolveCallerTenantId(request.user);
    await this.advertsService.remove(
      tenantId,
      id,
      extractAuditRequestContext(request),
    );
    return { message: 'Advert deleted successfully' };
  }
}
