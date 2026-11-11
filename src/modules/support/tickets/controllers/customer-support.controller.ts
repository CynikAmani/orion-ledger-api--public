import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
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
import { CreateSupportTicketDto } from '../dto/create-support-ticket.dto';
import { CreateTicketMessageDto } from '../dto/create-ticket-message.dto';
import {
  TicketsService,
  type SupportTicketDetailResponse,
  type SupportTicketResponse,
  type TicketMessageResponse,
} from '../services/tickets.service';
import {
  CREATE_SUPPORT_TICKET_MULTIPART_BODY,
  CREATE_TICKET_MESSAGE_MULTIPART_BODY,
} from '../swagger/ticket-multipart.swagger';

@ApiTags('Support - Customer')
@ApiBearerAuth('bearer')
@Controller('support/customer/tickets')
export class CustomerSupportController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  @Permission(PERMISSIONS.SUPPORT.CUSTOMER_CREATE)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  @ApiConsumes('multipart/form-data')
  @ApiBody(CREATE_SUPPORT_TICKET_MULTIPART_BODY)
  @ApiOperation({
    summary:
      'Open a support ticket (platform or institution-targeted; optional loan / application context)',
  })
  @ApiResponse({ status: 201, description: 'Ticket created' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateSupportTicketDto,
    @UploadedFile(optionalSupportTicketImageFilePipe)
    file?: Express.Multer.File,
  ): Promise<SupportTicketDetailResponse> {
    return this.ticketsService.create(
      request.user.id,
      dto,
      extractAuditRequestContext(request),
      file,
    );
  }

  @Get()
  @Permission(PERMISSIONS.SUPPORT.CUSTOMER_READ)
  @ApiOperation({
    summary:
      'List my support tickets (platform and institution-targeted)',
  })
  @ApiResponse({ status: 200, description: 'Own ticket list' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  findMine(
    @Req() request: AuthenticatedRequest,
  ): Promise<SupportTicketResponse[]> {
    return this.ticketsService.findMine(request.user.id);
  }

  @Get(':id')
  @Permission(PERMISSIONS.SUPPORT.CUSTOMER_READ)
  @ApiOperation({ summary: 'Get one of my support tickets with messages' })
  @ApiResponse({ status: 200, description: 'Ticket detail' })
  @ApiNotFoundResponse({ description: 'Ticket not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  findOneMine(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<SupportTicketDetailResponse> {
    return this.ticketsService.findOneMine(request.user.id, id);
  }

  @Post(':id/messages')
  @Permission(PERMISSIONS.SUPPORT.CUSTOMER_REPLY)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  @ApiConsumes('multipart/form-data')
  @ApiBody(CREATE_TICKET_MESSAGE_MULTIPART_BODY)
  @ApiOperation({ summary: 'Reply on my support ticket' })
  @ApiResponse({ status: 201, description: 'Message created' })
  @ApiNotFoundResponse({ description: 'Ticket not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  addMessage(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateTicketMessageDto,
    @UploadedFile(optionalSupportTicketImageFilePipe)
    file?: Express.Multer.File,
  ): Promise<TicketMessageResponse> {
    return this.ticketsService.addCustomerMessage(
      request.user.id,
      id,
      dto,
      extractAuditRequestContext(request),
      file,
    );
  }

  @Patch(':id/read')
  @Permission(PERMISSIONS.SUPPORT.CUSTOMER_READ)
  @ApiOperation({ summary: 'Mark staff replies as read on my ticket' })
  @ApiResponse({ status: 200, description: 'Unread staff flag cleared' })
  @ApiNotFoundResponse({ description: 'Ticket not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  markRead(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<SupportTicketResponse> {
    return this.ticketsService.markCustomerSideRead(
      request.user.id,
      id,
      extractAuditRequestContext(request),
    );
  }
}
