import { Controller, Get, Header, Param } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { PERMISSIONS } from '../../../auth/shared/constants/permissions.constant';
import { Permission } from '../../../auth/shared/decorators/permission.decorator';
import {
  CustomerIdentityDocumentsService,
  type CustomerIdentityDocumentResponse,
} from '../../../customers/identity-documents/services/customer-identity-documents.service';
import {
  CustomerLoanActivityService,
  type CustomerLoanActivityResponse,
} from '../../../customers/loan-activity/services/customer-loan-activity.service';
import {
  UserEligibilityService,
  type UserEligibilityResponse,
} from '../../shared/services/user-eligibility.service';
import {
  UserManagementService,
  type ManagedUserDetail,
} from '../shared/services/user-management.service';
import {
  ManagedUserService,
  type ManagedUserContactDetails,
} from '../services/managed-user.service';

const PLATFORM_USER_SCOPE = { kind: 'platform' as const };

@ApiTags('Users')
@ApiBearerAuth('bearer')
@Controller('users')
export class StaffUserController {
  constructor(
    private readonly managedUserService: ManagedUserService,
    private readonly userManagementService: UserManagementService,
    private readonly customerLoanActivityService: CustomerLoanActivityService,
    private readonly customerIdentityDocumentsService: CustomerIdentityDocumentsService,
    private readonly userEligibilityService: UserEligibilityService,
  ) {}

  /**
   * Tenant staff — read-only platform customer profile for application review.
   * Scoped to platform users only (User.tenantId IS NULL); never tenant members.
   */
  @Get(':userId/profile')
  @Permission(PERMISSIONS.TENANT.PLATFORM_USERS_READ)
  @ApiOperation({
    summary:
      'Get a platform customer profile (tenant review during loan application handling or similar)',
  })
  @ApiResponse({ status: 200, description: 'Platform user profile' })
  @ApiNotFoundResponse({ description: 'Platform user not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  getPlatformCustomerProfile(
    @Param('userId') userId: string,
  ): Promise<ManagedUserDetail> {
    return this.userManagementService.findOne(PLATFORM_USER_SCOPE, userId);
  }

  @Get(':userId/contact')
  @Permission(PERMISSIONS.CUSTOMERS.READ)
  @ApiOperation({ summary: 'Get contact details for a customer' })
  @ApiResponse({ status: 200, description: 'User contact details' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  getContactDetails(
    @Param('userId') userId: string,
  ): Promise<ManagedUserContactDetails> {
    return this.managedUserService.getContactDetails(userId);
  }

  @Get(':userId/loan-activity')
  @Permission(PERMISSIONS.CUSTOMERS.LOAN_ACTIVITY_READ)
  @ApiOperation({ summary: 'Get loan activity counters for a customer' })
  @ApiResponse({ status: 200, description: 'User loan activity snapshot' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  getLoanActivity(
    @Param('userId') userId: string,
  ): Promise<CustomerLoanActivityResponse> {
    return this.customerLoanActivityService.getByCustomerId(userId);
  }

  @Get(':userId/identity-document')
  @Permission(PERMISSIONS.CUSTOMERS.IDENTITY_READ)
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: 'Get a customer identity document and signature' })
  @ApiResponse({ status: 200, description: 'User identity document details' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  getIdentityDocument(
    @Param('userId') userId: string,
  ): Promise<CustomerIdentityDocumentResponse> {
    return this.customerIdentityDocumentsService.getByCustomerId(userId);
  }

  @Get(':userId/eligibility')
  @Permission(PERMISSIONS.CUSTOMERS.ELIGIBILITY_READ)
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    summary: 'Check whether a customer is eligible for loan issuance',
  })
  @ApiResponse({
    status: 200,
    description: 'Loan issuance eligibility status and missing requirements',
  })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  getEligibility(
    @Param('userId') userId: string,
  ): Promise<UserEligibilityResponse> {
    return this.userEligibilityService.getLoanIssuanceEligibility(userId);
  }
}
