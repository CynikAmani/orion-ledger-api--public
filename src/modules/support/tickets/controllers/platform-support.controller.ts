import {
  Body,
  Controller,
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
import { optionalSupportTicketImageFilePipe } from '../../../../core/storage/pipes/optional-support-ticket-image-file.pipe';
import { PERMISSIONS } from '../../../auth/shared/constants/permissions.constant';
import { Permission } from '../../../auth/shared/decorators/permission.decorator';
import type { AuthenticatedRequest } from '../../../auth/shared/guards/permission.guard';
import { CreateTicketMessageDto } from '../dto/create-ticket-message.dto';
import { ListSupportTicketsQueryDto } from '../dto/list-support-tickets-query.dto';
import { ReassignTicketHandlerDto } from '../dto/reassign-ticket-handler.dto';
import { UpdateTicketPriorityDto } from '../dto/update-ticket-priority.dto';
import { UpdateTicketStatusDto } from '../dto/update-ticket-status.dto';
import {
  TicketsService,
  type SupportTicketDetailResponse,
  type SupportTicketResponse,
  type TicketMessageResponse,
} from '../services/tickets.service';
import { CREATE_TICKET_MESSAGE_MULTIPART_BODY } from '../swagger/ticket-multipart.swagger';

@ApiTags('Support - Platform')
@ApiBearerAuth('bearer')
@Controller('support/platform/tickets')
export class PlatformSupportController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  @Permission(PERMISSIONS.SUPPORT.PLATFORM_READ)
  @ApiOperation({
    summary:
      'List platform-level support queue (tenantId IS NULL; default OPEN + IN_PROGRESS)',
  })
  @ApiResponse({ status: 200, description: 'Platform ticket list' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  findAll(
    @Query() query: ListSupportTicketsQueryDto,
  ): Promise<SupportTicketResponse[]> {
    return this.ticketsService.findAll({ tenantId: null }, query);
  }

  @Get(':id')
  @Permission(PERMISSIONS.SUPPORT.PLATFORM_READ)
  @ApiOperation({
    summary: 'Get a platform-level support ticket with messages',
  })
  @ApiResponse({ status: 200, description: 'Ticket detail' })
  @ApiNotFoundResponse({ description: 'Ticket not found' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<SupportTicketDetailResponse> {
    return this.ticketsService.findOne({ tenantId: null }, id);
  }

  @Post(':id/messages')
  @Permission(PERMISSIONS.SUPPORT.PLATFORM_REPLY)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  @ApiConsumes('multipart/form-data')
  @ApiBody(CREATE_TICKET_MESSAGE_MULTIPART_BODY)
  @ApiOperation({ summary: 'Platform staff reply on a platform ticket' })
  @ApiResponse({ status: 201, description: 'Message created' })
  addStaffMessage(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateTicketMessageDto,
    @UploadedFile(optionalSupportTicketImageFilePipe)
    file?: Express.Multer.File,
  ): Promise<TicketMessageResponse> {
    return this.ticketsService.addStaffMessage(
      { tenantId: null },
      request.user.id,
      id,
      dto,
      extractAuditRequestContext(request),
      file,
    );
  }

  @Patch(':id/status')
  @Permission(PERMISSIONS.SUPPORT.PLATFORM_UPDATE_STATUS)
  @ApiOperation({ summary: 'Update platform ticket status' })
  @ApiResponse({ status: 200, description: 'Status updated' })
  updateStatus(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTicketStatusDto,
  ): Promise<SupportTicketResponse> {
    return this.ticketsService.updateStatus(
      { tenantId: null },
      id,
      dto,
      extractAuditRequestContext(request),
    );
  }

  @Patch(':id/priority')
  @Permission(PERMISSIONS.SUPPORT.PLATFORM_UPDATE_PRIORITY)
  @ApiOperation({ summary: 'Update platform ticket priority' })
  @ApiResponse({ status: 200, description: 'Priority updated' })
  updatePriority(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTicketPriorityDto,
  ): Promise<SupportTicketResponse> {
    return this.ticketsService.updatePriority(
      { tenantId: null },
      id,
      dto,
      extractAuditRequestContext(request),
    );
  }

  @Patch(':id/handler')
  @Permission(PERMISSIONS.SUPPORT.PLATFORM_ASSIGN)
  @ApiOperation({
    summary: 'Reassign handler (must be a platform user, tenantId null)',
  })
  @ApiResponse({ status: 200, description: 'Handler reassigned' })
  reassignHandler(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReassignTicketHandlerDto,
  ): Promise<SupportTicketResponse> {
    return this.ticketsService.reassignHandler(
      { tenantId: null },
      id,
      dto,
      extractAuditRequestContext(request),
    );
  }

  @Patch(':id/read')
  @Permission(PERMISSIONS.SUPPORT.PLATFORM_READ)
  @ApiOperation({ summary: 'Mark customer replies as read (platform staff)' })
  @ApiResponse({ status: 200, description: 'Unread customer flag cleared' })
  markRead(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<SupportTicketResponse> {
    return this.ticketsService.markStaffSideRead(
      { tenantId: null },
      id,
      extractAuditRequestContext(request),
    );
  }
}
