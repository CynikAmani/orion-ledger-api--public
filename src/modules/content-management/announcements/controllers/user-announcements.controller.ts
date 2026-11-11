import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { extractAuditRequestContext } from '../../../../core/audit/utils/audit-request-context.util';
import { Authenticated } from '../../../auth/shared/decorators/authenticated.decorator';
import type { AuthenticatedRequest } from '../../../auth/shared/guards/permission.guard';
import {
  AnnouncementsService,
  type AnnouncementResponse,
  type DismissAnnouncementResponse,
} from '../services/announcements.service';

@ApiTags('Announcements')
@ApiBearerAuth('bearer')
@Controller('announcements')
export class UserAnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get()
  @Authenticated()
  @ApiOperation({
    summary:
      'List currently running announcements the authenticated user has not dismissed',
  })
  @ApiResponse({
    status: 200,
    description: 'Undismissed running announcements',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  findVisible(
    @Req() request: AuthenticatedRequest,
  ): Promise<AnnouncementResponse[]> {
    return this.announcementsService.findVisibleForUser(
      request.user.id,
      request.user.tenantId ?? null,
    );
  }

  @Post(':id/dismiss')
  @Authenticated()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Dismiss an announcement so it is not shown again to this user',
  })
  @ApiResponse({ status: 200, description: 'Announcement dismissed' })
  @ApiNotFoundResponse({ description: 'Announcement not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  dismiss(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DismissAnnouncementResponse> {
    return this.announcementsService.dismiss(
      request.user.id,
      id,
      extractAuditRequestContext(request),
      request.user.tenantId ?? null,
    );
  }
}
