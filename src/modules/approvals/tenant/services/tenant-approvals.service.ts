import { Injectable } from '@nestjs/common';
import type { AuditContext } from '../../../../core/audit/interfaces/audit-payload.interface';
import type { AuthenticatedUser } from '../../../auth/shared/types/authenticated-user.type';
import { resolveCallerTenantId } from '../../../roles/shared/utils/resolve-caller-tenant.util';
import { CreateTenantApprovalRequestDto } from '../../shared/dto/approval-request.dto';
import {
  ApprovalRequestsService,
  type ApprovalRequestResponse,
} from '../../shared/services/approval-requests.service';

@Injectable()
export class TenantApprovalsService {
  constructor(private readonly approvalRequests: ApprovalRequestsService) {}

  submit(
    user: AuthenticatedUser,
    dto: CreateTenantApprovalRequestDto,
    auditContext: AuditContext,
    requestedTenantId?: string | string[],
  ): Promise<ApprovalRequestResponse> {
    const tenantId = resolveCallerTenantId(user, requestedTenantId);
    return this.approvalRequests.submitTenantChange(
      tenantId,
      user.id,
      dto,
      auditContext,
    );
  }
}
