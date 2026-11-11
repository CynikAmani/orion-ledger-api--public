import {
  Controller,
  Get,
  Param,
  Req,
  StreamableFile,
  VERSION_NEUTRAL,
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
import { UPLOAD_DIRS } from '../../../../core/storage/constants/upload-dirs.constant';
import { Authenticated } from '../../../auth/shared/decorators/authenticated.decorator';
import type { AuthenticatedRequest } from '../../../auth/shared/guards/permission.guard';
import { TicketsService } from '../services/tickets.service';

/**
 * Serves support ticket images at the same URL pattern as stored uploads
 * (`/${UPLOAD_DIRS.SUPPORT_TICKETS}/:filename`), but requires authentication.
 * Excluded from the `/api` global prefix in main.ts.
 */
@ApiTags('Support - Ticket Attachments')
@ApiBearerAuth('bearer')
@Controller({
  path: UPLOAD_DIRS.SUPPORT_TICKETS,
  version: VERSION_NEUTRAL,
})
export class SupportTicketAttachmentsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get(':filename')
  @Authenticated()
  @ApiOperation({
    summary:
      'Serve a support ticket attachment by filename (ticket owner or support staff)',
  })
  @ApiResponse({ status: 200, description: 'Attachment file stream' })
  @ApiNotFoundResponse({ description: 'Attachment not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  getAttachment(
    @Req() request: AuthenticatedRequest,
    @Param('filename') filename: string,
  ): Promise<StreamableFile> {
    return this.ticketsService.getAttachmentByFilename(
      filename,
      request.user,
    );
  }
}
