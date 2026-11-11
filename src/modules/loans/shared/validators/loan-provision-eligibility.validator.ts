import { HttpStatus, Injectable } from '@nestjs/common';
import {
  APP_ERROR_CODES,
  appHttpException,
} from '../../../../common/exceptions/app-http.exception';
import { TermsAndConditionsService } from '../../../system-configurations/platform/terms-and-conditions/services/terms-and-conditions.service';
import { TenantTermsAndConditionsService } from '../../../system-configurations/tenant/tenant-terms-and-conditions/services/tenant-terms-and-conditions.service';
import { IdentityDocumentStorageService } from '../../../users/shared/services/identity-document-storage.service';

type AgreementGateError =
  | typeof APP_ERROR_CODES.CUSTOMER_AGREEMENTS_NOT_ACCEPTED
  | typeof APP_ERROR_CODES.CUSTOMER_TENANT_AGREEMENTS_NOT_ACCEPTED
  | typeof APP_ERROR_CODES.STAFF_AGREEMENTS_NOT_ACCEPTED;

type IdentityGateError =
  | typeof APP_ERROR_CODES.CUSTOMER_IDENTITY_NOT_VERIFIED
  | typeof APP_ERROR_CODES.STAFF_IDENTITY_NOT_VERIFIED;

/**
 * Pre-flight gates before staff create / approve / issue a loan.
 * Frontend badges are UX only — these asserts are the API final boss.
 *
 * Agreement and identity checks are role-agnostic; callers pass the
 * stable errorCode for whichever user id they are validating.
 */
@Injectable()
export class LoanProvisionEligibilityValidator {
  constructor(
    private readonly termsAndConditionsService: TermsAndConditionsService,
    private readonly tenantTermsAndConditionsService: TenantTermsAndConditionsService,
    private readonly identityDocumentStorageService: IdentityDocumentStorageService,
  ) {}

  async assertLoanProvisionEligibility(
    customerId: number,
    staffId: number,
  ): Promise<void> {
    await this.assertUserAgreementsAccepted(customerId, {
      errorCode: APP_ERROR_CODES.CUSTOMER_AGREEMENTS_NOT_ACCEPTED,
      message:
        'Customer must accept the current Terms of Service and Privacy Policy before a loan can be provisioned',
    });
    await this.assertUserIdentityVerified(customerId, {
      errorCode: APP_ERROR_CODES.CUSTOMER_IDENTITY_NOT_VERIFIED,
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      message: 'Customer identity document is missing or unverified',
    });
    await this.assertUserAgreementsAccepted(staffId, {
      errorCode: APP_ERROR_CODES.STAFF_AGREEMENTS_NOT_ACCEPTED,
      message:
        'Staff must accept the current Terms of Service and Privacy Policy before provisioning a loan',
    });
    await this.assertUserIdentityVerified(staffId, {
      errorCode: APP_ERROR_CODES.STAFF_IDENTITY_NOT_VERIFIED,
      status: HttpStatus.FORBIDDEN,
      message: 'Staff identity document is missing or unverified',
    });
  }

  async assertUserAgreementsAccepted(
    userId: number,
    options: {
      errorCode: AgreementGateError;
      message: string;
      status?: HttpStatus;
    },
  ): Promise<void> {
    const status =
      await this.termsAndConditionsService.getStatusForUser(userId);

    if (status.requiresAcceptance) {
      throw appHttpException(
        options.status ?? HttpStatus.FORBIDDEN,
        options.message,
        options.errorCode,
      );
    }
  }

  /**
   * Institution-scoped gate — customer must accept that tenant's published T&C/privacy.
   */
  async assertUserTenantAgreementsAccepted(
    userId: number,
    tenantId: string,
  ): Promise<void> {
    await this.tenantTermsAndConditionsService.assertCurrentAgreementsAccepted(
      tenantId,
      userId,
    );
  }

  async assertUserIdentityVerified(
    userId: number,
    options: {
      errorCode: IdentityGateError;
      message: string;
      status: HttpStatus;
    },
  ): Promise<void> {
    const status =
      await this.identityDocumentStorageService.getVerificationStatus(userId);
    const verified = status.hasNationalId && status.hasIdentityDocument;

    if (!verified) {
      throw appHttpException(options.status, options.message, options.errorCode);
    }
  }
}
