import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { extractAuditRequestContext } from '../../../../core/audit/utils/audit-request-context.util';
import { PERMISSIONS } from '../../../auth/shared/constants/permissions.constant';
import { Permission } from '../../../auth/shared/decorators/permission.decorator';
import type { AuthenticatedRequest } from '../../../auth/shared/guards/permission.guard';
import {
  ListApprovalRequestsQueryDto,
  RejectApprovalRequestDto,
} from '../../shared/dto/approval-request.dto';
import type {
  ApprovalRequestResponse,
  PaginatedApprovalRequestsResponse,
} from '../../shared/services/approval-requests.service';
import { PlatformApprovalsService } from '../services/platform-approvals.service';

@ApiTags('Approvals - Platform')
@ApiBearerAuth('bearer')
@Controller('platform/approvals')
export class PlatformApprovalsController {
  constructor(
    private readonly platformApprovalsService: PlatformApprovalsService,
  ) {}

  @Get()
  @Permission(PERMISSIONS.PLATFORM.APPROVALS_READ)
  @ApiOperation({
    summary: 'List tenant change requests (defaults to pending)',
  })
  @ApiResponse({ status: 200, description: 'Paginated approval queue' })
  list(
    @Query() query: ListApprovalRequestsQueryDto,
  ): Promise<PaginatedApprovalRequestsResponse> {
    return this.platformApprovalsService.list(query);
  }

  @Post(':publicId/approve')
  @Permission(PERMISSIONS.PLATFORM.APPROVALS_MANAGE)
  @ApiOperation({ summary: 'Approve a pending tenant change request' })
  @ApiResponse({
    status: 201,
    description: 'Change applied and request approved',
  })
  @ApiNotFoundResponse({ description: 'Approval request not found' })
  @ApiConflictResponse({
    description: 'Request is not pending or slug is taken',
  })
  approve(
    @Req() request: AuthenticatedRequest,
    @Param('publicId') publicId: string,
  ): Promise<ApprovalRequestResponse> {
    return this.platformApprovalsService.approve(
      publicId,
      request.user.id,
      extractAuditRequestContext(request),
    );
  }

  @Post(':publicId/reject')
  @Permission(PERMISSIONS.PLATFORM.APPROVALS_MANAGE)
  @ApiOperation({ summary: 'Reject a pending tenant change request' })
  @ApiResponse({ status: 201, description: 'Request rejected' })
  @ApiNotFoundResponse({ description: 'Approval request not found' })
  reject(
    @Req() request: AuthenticatedRequest,
    @Param('publicId') publicId: string,
    @Body() dto: RejectApprovalRequestDto,
  ): Promise<ApprovalRequestResponse> {
    return this.platformApprovalsService.reject(
      publicId,
      request.user.id,
      dto,
      extractAuditRequestContext(request),
    );
  }
}
