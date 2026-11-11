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
import { resolveCallerTenantId } from '../../../roles/shared/utils/resolve-caller-tenant.util';
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

@ApiTags('Support - Tenant')
@ApiBearerAuth('bearer')
@Controller('support/tenant/tickets')
export class TenantSupportController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  @Permission(PERMISSIONS.SUPPORT.TENANT_READ)
  @ApiOperation({
    summary:
      "List this institution's support queue (default: OPEN + IN_PROGRESS)",
  })
  @ApiResponse({ status: 200, description: 'Tenant ticket list' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or tenant membership required',
  })
  findAll(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListSupportTicketsQueryDto,
  ): Promise<SupportTicketResponse[]> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.ticketsService.findAll({ tenantId }, query);
  }

  @Get(':id')
  @Permission(PERMISSIONS.SUPPORT.TENANT_READ)
  @ApiOperation({ summary: 'Get a tenant-scoped support ticket with messages' })
  @ApiResponse({ status: 200, description: 'Ticket detail' })
  @ApiNotFoundResponse({ description: 'Ticket not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or tenant membership required',
  })
  findOne(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<SupportTicketDetailResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.ticketsService.findOne({ tenantId }, id);
  }

  @Post(':id/messages')
  @Permission(PERMISSIONS.SUPPORT.TENANT_REPLY)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  @ApiConsumes('multipart/form-data')
  @ApiBody(CREATE_TICKET_MESSAGE_MULTIPART_BODY)
  @ApiOperation({ summary: 'Staff reply on a tenant support ticket' })
  @ApiResponse({ status: 201, description: 'Message created' })
  @ApiNotFoundResponse({ description: 'Ticket not found' })
  addStaffMessage(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateTicketMessageDto,
    @UploadedFile(optionalSupportTicketImageFilePipe)
    file?: Express.Multer.File,
  ): Promise<TicketMessageResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.ticketsService.addStaffMessage(
      { tenantId },
      request.user.id,
      id,
      dto,
      extractAuditRequestContext(request),
      file,
    );
  }

  @Patch(':id/status')
  @Permission(PERMISSIONS.SUPPORT.TENANT_UPDATE_STATUS)
  @ApiOperation({ summary: 'Update tenant ticket status' })
  @ApiResponse({ status: 200, description: 'Status updated' })
  updateStatus(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTicketStatusDto,
  ): Promise<SupportTicketResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.ticketsService.updateStatus(
      { tenantId },
      id,
      dto,
      extractAuditRequestContext(request),
    );
  }

  @Patch(':id/priority')
  @Permission(PERMISSIONS.SUPPORT.TENANT_UPDATE_PRIORITY)
  @ApiOperation({ summary: 'Update tenant ticket priority' })
  @ApiResponse({ status: 200, description: 'Priority updated' })
  updatePriority(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTicketPriorityDto,
  ): Promise<SupportTicketResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.ticketsService.updatePriority(
      { tenantId },
      id,
      dto,
      extractAuditRequestContext(request),
    );
  }

  @Patch(':id/handler')
  @Permission(PERMISSIONS.SUPPORT.TENANT_ASSIGN)
  @ApiOperation({
    summary: 'Reassign handler (must be a member of this tenant)',
  })
  @ApiResponse({ status: 200, description: 'Handler reassigned' })
  reassignHandler(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReassignTicketHandlerDto,
  ): Promise<SupportTicketResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.ticketsService.reassignHandler(
      { tenantId },
      id,
      dto,
      extractAuditRequestContext(request),
    );
  }

  @Patch(':id/read')
  @Permission(PERMISSIONS.SUPPORT.TENANT_READ)
  @ApiOperation({ summary: 'Mark customer replies as read (tenant staff)' })
  @ApiResponse({ status: 200, description: 'Unread customer flag cleared' })
  markRead(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<SupportTicketResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.ticketsService.markStaffSideRead(
      { tenantId },
      id,
      extractAuditRequestContext(request),
    );
  }
}
