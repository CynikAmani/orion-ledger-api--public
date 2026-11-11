import {
  Body,
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
import { extractAuditRequestContext } from '../../../../../core/audit/utils/audit-request-context.util';
import { AllowExpiredSubscription } from '../../../../auth/shared/decorators/allow-expired-subscription.decorator';
import { Authenticated } from '../../../../auth/shared/decorators/authenticated.decorator';
import type { AuthenticatedRequest } from '../../../../auth/shared/guards/permission.guard';
import { AcceptAgreementsDto } from '../dto/accept-agreements.dto';
import {
  TermsAndConditionsService,
  type AcceptAgreementResponse,
  type AcceptAgreementsResponse,
  type UserAgreementStatusResponse,
} from '../services/terms-and-conditions.service';

@ApiTags('Agreements')
@ApiBearerAuth('bearer')
@AllowExpiredSubscription()
@Controller('agreements')
export class UserAgreementsController {
  constructor(
    private readonly termsAndConditionsService: TermsAndConditionsService,
  ) {}

  @Get('status')
  @Authenticated()
  @ApiOperation({
    summary:
      'Get whether the current user has accepted the currently published Terms of Service and Privacy Policy',
  })
  @ApiResponse({
    status: 200,
    description:
      'Each published agreement is checked independently by ID. requiresAcceptance is true when at least one active document has not been accepted.',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  getStatus(
    @Req() request: AuthenticatedRequest,
  ): Promise<UserAgreementStatusResponse> {
    return this.termsAndConditionsService.getStatusForUser(request.user.id);
  }

  @Post('accept')
  @Authenticated()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Accept one or more currently published agreements in a single request',
  })
  @ApiResponse({
    status: 200,
    description:
      'Stores an acceptance per agreement ID. Repeat calls for the same ID return the original acceptance.',
  })
  @ApiNotFoundResponse({ description: 'Agreement not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  acceptMany(
    @Req() request: AuthenticatedRequest,
    @Body() dto: AcceptAgreementsDto,
  ): Promise<AcceptAgreementsResponse> {
    return this.termsAndConditionsService.accept(
      request.user.id,
      dto.agreementIds,
      request.ip,
      extractAuditRequestContext(request),
    );
  }

  @Post(':id/accept')
  @Authenticated()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Accept a currently published Terms of Service or Privacy Policy',
  })
  @ApiResponse({
    status: 200,
    description:
      'Stores acceptance for this agreement ID. Repeat calls return the original acceptance; a newer published version must be accepted separately.',
  })
  @ApiNotFoundResponse({ description: 'Agreement not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  accept(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<AcceptAgreementResponse> {
    return this.termsAndConditionsService.accept(
      request.user.id,
      id,
      request.ip,
      extractAuditRequestContext(request),
    );
  }
}
