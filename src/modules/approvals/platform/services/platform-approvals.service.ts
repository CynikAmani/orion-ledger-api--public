import { Injectable } from '@nestjs/common';
import type { AuditContext } from '../../../../core/audit/interfaces/audit-payload.interface';
import {
  ApprovalRequestsService,
  type ApprovalRequestResponse,
  type PaginatedApprovalRequestsResponse,
} from '../../shared/services/approval-requests.service';
import {
  ListApprovalRequestsQueryDto,
  RejectApprovalRequestDto,
} from '../../shared/dto/approval-request.dto';

@Injectable()
export class PlatformApprovalsService {
  constructor(private readonly approvalRequests: ApprovalRequestsService) {}

  list(
    query: ListApprovalRequestsQueryDto,
  ): Promise<PaginatedApprovalRequestsResponse> {
    return this.approvalRequests.listPlatformQueue(query);
  }

  approve(
    publicId: string,
    reviewedById: number,
    auditContext: AuditContext,
  ): Promise<ApprovalRequestResponse> {
    return this.approvalRequests.approve(publicId, reviewedById, auditContext);
  }

  reject(
    publicId: string,
    reviewedById: number,
    dto: RejectApprovalRequestDto,
    auditContext: AuditContext,
  ): Promise<ApprovalRequestResponse> {
    return this.approvalRequests.reject(
      publicId,
      reviewedById,
      dto,
      auditContext,
    );
  }
}
