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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { extractAuditRequestContext } from '../../../../core/audit/utils/audit-request-context.util';
import { Permission } from '../../../auth/shared/decorators/permission.decorator';
import { PERMISSIONS } from '../../../auth/shared/constants/permissions.constant';
import type { AuthenticatedRequest } from '../../../auth/shared/guards/permission.guard';
import { resolveCallerTenantId } from '../../../roles/shared/utils/resolve-caller-tenant.util';
import { CreateAnnouncementDto } from '../dto/create-announcement.dto';
import { ListAnnouncementsQueryDto } from '../dto/list-announcements-query.dto';
import { UpdateAnnouncementDto } from '../dto/update-announcement.dto';
import {
  AnnouncementsService,
  type AnnouncementResponse,
} from '../services/announcements.service';

@ApiTags('Content Management - Announcements')
@ApiBearerAuth('bearer')
@Controller('content-management/announcements')
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Post()
  @Permission(PERMISSIONS.CONTENT_MANAGEMENT.ANNOUNCEMENTS_CREATE)
  @ApiOperation({
    summary: 'Create an announcement for the caller\'s tenant',
  })
  @ApiResponse({ status: 201, description: 'Announcement created' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or tenant membership required',
  })
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateAnnouncementDto,
  ): Promise<AnnouncementResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.announcementsService.create(
      tenantId,
      dto,
      extractAuditRequestContext(request),
    );
  }

  @Get()
  @Permission(PERMISSIONS.CONTENT_MANAGEMENT.ANNOUNCEMENTS_READ)
  @ApiOperation({
    summary:
      'List announcements for the caller\'s tenant (filter by active, running, expired, or upcoming)',
  })
  @ApiResponse({ status: 200, description: 'Announcement list' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or tenant membership required',
  })
  findAll(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListAnnouncementsQueryDto,
  ): Promise<AnnouncementResponse[]> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.announcementsService.findAll(tenantId, query);
  }

  @Get(':id')
  @Permission(PERMISSIONS.CONTENT_MANAGEMENT.ANNOUNCEMENTS_READ)
  @ApiOperation({
    summary: 'Get an announcement by ID for the caller\'s tenant',
  })
  @ApiResponse({ status: 200, description: 'Announcement found' })
  @ApiNotFoundResponse({ description: 'Announcement not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or tenant membership required',
  })
  findOne(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<AnnouncementResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.announcementsService.findOne(tenantId, id);
  }

  @Patch(':id')
  @Permission(PERMISSIONS.CONTENT_MANAGEMENT.ANNOUNCEMENTS_UPDATE)
  @ApiOperation({
    summary: 'Partially update an announcement for the caller\'s tenant',
  })
  @ApiResponse({ status: 200, description: 'Announcement updated' })
  @ApiNotFoundResponse({ description: 'Announcement not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or tenant membership required',
  })
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAnnouncementDto,
  ): Promise<AnnouncementResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.announcementsService.update(
      tenantId,
      id,
      dto,
      extractAuditRequestContext(request),
    );
  }

  @Delete(':id')
  @Permission(PERMISSIONS.CONTENT_MANAGEMENT.ANNOUNCEMENTS_DELETE)
  @ApiOperation({
    summary: 'Delete an announcement for the caller\'s tenant',
  })
  @ApiResponse({ status: 200, description: 'Announcement deleted' })
  @ApiNotFoundResponse({ description: 'Announcement not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or tenant membership required',
  })
  async remove(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string }> {
    const tenantId = resolveCallerTenantId(request.user);
    await this.announcementsService.remove(
      tenantId,
      id,
      extractAuditRequestContext(request),
    );
    return { message: 'Announcement deleted successfully' };
  }
}
