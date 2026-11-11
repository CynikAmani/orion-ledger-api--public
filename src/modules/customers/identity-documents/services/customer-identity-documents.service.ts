import { Injectable, NotFoundException } from '@nestjs/common';
import {
  IdentityDocumentStorageService,
  type IdentityDocumentResponse,
} from '../../../users/shared/services/identity-document-storage.service';
import { UserAccountLifecycleValidator } from '../../../users/shared/validators/user-account-lifecycle.validator';

export interface CustomerIdentityDocumentResponse {
  customerId: string;
  fullname: string;
  nationalId: string;
  identityDocumentDataUrl: string | null;
  signatureDataUrl: string | null;
}

@Injectable()
export class CustomerIdentityDocumentsService {
  constructor(
    private readonly identityDocumentStorage: IdentityDocumentStorageService,
    private readonly userAccountLifecycleValidator: UserAccountLifecycleValidator,
  ) {}

  /**
   * Staff read-only payload for user management, application review, and loan review.
   */
  async getByCustomerId(
    customerId: string,
  ): Promise<CustomerIdentityDocumentResponse> {
    try {
      return this.toStaffResponse(
        await this.identityDocumentStorage.getByUserId(
          (await this.userAccountLifecycleValidator.getUserIfExists(customerId))
            .id,
        ),
      );
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(`Customer ${customerId} was not found`);
      }

      throw error;
    }
  }

  private toStaffResponse(
    row: IdentityDocumentResponse,
  ): CustomerIdentityDocumentResponse {
    return {
      customerId: row.userId,
      fullname: row.fullname,
      nationalId: row.nationalId,
      identityDocumentDataUrl: row.identityDocumentDataUrl,
      signatureDataUrl: row.signatureDataUrl,
    };
  }
}
