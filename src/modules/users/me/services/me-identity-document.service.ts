import { Injectable } from '@nestjs/common';
import type { AuditContext } from '../../../../core/audit/interfaces/audit-payload.interface';
import { AuditEmitterService } from '../../../../core/audit/services/audit-emitter.service';
import {
  IdentityDocumentStorageService,
  type IdentityDocumentResponse,
} from '../../shared/services/identity-document-storage.service';
import { ME_AUDIT_ACTIONS } from '../constants/me-audit-actions.constant';

@Injectable()
export class MeIdentityDocumentService {
  constructor(
    private readonly identityDocumentStorage: IdentityDocumentStorageService,
    private readonly auditEmitter: AuditEmitterService,
  ) {}

  getMine(id: number): Promise<IdentityDocumentResponse> {
    return this.identityDocumentStorage.getByUserId(id);
  }

  async upsertMine(
    id: number,
    files: {
      identityDocument?: Express.Multer.File;
      signature?: Express.Multer.File;
    },
    auditContext: AuditContext,
    tenantId?: string | null,
  ): Promise<IdentityDocumentResponse> {
    const saved = await this.identityDocumentStorage.upsert(id, files);

    this.auditEmitter.emit({
      ...auditContext,
      tenantId: tenantId ?? undefined,
      module: 'SELF',
      targetType: 'IdentityDocument',
      targetId: saved.userId,
      action: ME_AUDIT_ACTIONS.IDENTITY_DOCUMENT_UPSERTED,
      payload: {
        replacedIdentityDocument: Boolean(files.identityDocument),
        replacedSignature: Boolean(files.signature),
      },
    });

    return saved;
  }
}
