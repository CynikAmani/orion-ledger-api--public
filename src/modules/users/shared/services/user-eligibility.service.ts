import { Injectable } from '@nestjs/common';
import { TermsAndConditionsService } from '../../../system-configurations/platform/terms-and-conditions/services/terms-and-conditions.service';
import {
  IdentityDocumentStorageService,
  type IdentityDocumentVerificationStatus,
} from './identity-document-storage.service';
import { UserAccountLifecycleValidator } from '../validators/user-account-lifecycle.validator';

export type EligibilityStatus = 'ELIGIBLE' | 'NOT_ELIGIBLE';

export type MissingRequirement =
  | 'TERMS_AND_CONDITIONS'
  | 'IDENTITY_DOCUMENT'
  | 'SIGNATURE';

export interface UserEligibilityResponse {
  userId: string;
  status: EligibilityStatus;
  isEligible: boolean;
  criteria: {
    hasAgreedToTerms: boolean;
    hasIdentityDocument: boolean;
    hasSignature: boolean;
  };
  missingRequirements: MissingRequirement[];
}

@Injectable()
export class UserEligibilityService {
  constructor(
    private readonly termsAndConditionsService: TermsAndConditionsService,
    private readonly identityDocumentStorageService: IdentityDocumentStorageService,
    private readonly userAccountLifecycleValidator: UserAccountLifecycleValidator,
  ) {}

  async getLoanIssuanceEligibility(
    userId: string,
  ): Promise<UserEligibilityResponse> {
    const user =
      await this.userAccountLifecycleValidator.assertUserAccountIsNotDeleted(
        userId,
      );

    const [agreementStatus, identityStatus] = await Promise.all([
      this.termsAndConditionsService.getStatusForUser(user.id),
      this.identityDocumentStorageService.getVerificationStatus(user.id),
    ]);

    const hasAgreedToTerms = !agreementStatus.requiresAcceptance;
    const missingRequirements = this.getMissingRequirements(
      hasAgreedToTerms,
      identityStatus,
    );
    const isEligible = missingRequirements.length === 0;

    return {
      userId,
      status: isEligible ? 'ELIGIBLE' : 'NOT_ELIGIBLE',
      isEligible,
      criteria: {
        hasAgreedToTerms,
        hasIdentityDocument: identityStatus.hasIdentityDocument,
        hasSignature: identityStatus.hasSignature,
      },
      missingRequirements,
    };
  }

  private getMissingRequirements(
    hasAgreedToTerms: boolean,
    identityStatus: IdentityDocumentVerificationStatus,
  ): MissingRequirement[] {
    const missingRequirements: MissingRequirement[] = [];

    if (!hasAgreedToTerms) {
      missingRequirements.push('TERMS_AND_CONDITIONS');
    }
    if (!identityStatus.hasIdentityDocument) {
      missingRequirements.push('IDENTITY_DOCUMENT');
    }
    if (!identityStatus.hasSignature) {
      missingRequirements.push('SIGNATURE');
    }

    return missingRequirements;
  }
}