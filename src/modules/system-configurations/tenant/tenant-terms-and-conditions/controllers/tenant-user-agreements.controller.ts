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
import { Authenticated } from '../../../../auth/shared/decorators/authenticated.decorator';
import type { AuthenticatedRequest } from '../../../../auth/shared/guards/permission.guard';
import { TenantService } from '../../../../tenants/shared/services/tenant.service';
import { AcceptAgreementsDto } from '../../../platform/terms-and-conditions/dto/accept-agreements.dto';
import type {
  AcceptAgreementResponse,
  AcceptAgreementsResponse,
  UserAgreementStatusResponse,
} from '../../../platform/terms-and-conditions/services/terms-and-conditions.service';
import { TenantTermsAndConditionsService } from '../services/tenant-terms-and-conditions.service';

@ApiTags('Agreements - Tenant')
@ApiBearerAuth('bearer')
@Controller('tenants/:tenantIdentifier/agreements')
export class TenantUserAgreementsController {
  constructor(
    private readonly tenantService: TenantService,
    private readonly tenantTermsAndConditionsService: TenantTermsAndConditionsService,
  ) {}

  @Get('status')
  @Authenticated()
  @ApiOperation({
    summary:
      'Get whether the current user has accepted this institution\'s published Terms of Service and Privacy Policy',
  })
  @ApiResponse({
    status: 200,
    description:
      'Same shape as platform GET /agreements/status. requiresAcceptance is true when at least one active tenant document has not been accepted.',
  })
  @ApiNotFoundResponse({
    description: 'Target institution is currently unavailable or inactive',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async getStatus(
    @Req() request: AuthenticatedRequest,
    @Param('tenantIdentifier') tenantIdentifier: string,
  ): Promise<UserAgreementStatusResponse> {
    const tenant = await this.tenantService.resolveTenantByIdentifier(
      tenantIdentifier,
      { allowDemoWhenEnabled: true },
    );
    return this.tenantTermsAndConditionsService.getStatusForUser(
      tenant.tenantId,
      request.user.id,
    );
  }

  @Post('accept')
  @Authenticated()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Accept one or more of this institution\'s currently published agreements',
  })
  @ApiResponse({
    status: 200,
    description:
      'Same shape as platform POST /agreements/accept. Agreement IDs must belong to this tenant.',
  })
  @ApiNotFoundResponse({
    description: 'Institution or agreement not found',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async acceptMany(
    @Req() request: AuthenticatedRequest,
    @Param('tenantIdentifier') tenantIdentifier: string,
    @Body() dto: AcceptAgreementsDto,
  ): Promise<AcceptAgreementsResponse> {
    const tenant = await this.tenantService.resolveTenantByIdentifier(
      tenantIdentifier,
      { allowDemoWhenEnabled: true },
    );
    return this.tenantTermsAndConditionsService.accept(
      tenant.tenantId,
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
    summary:
      'Accept one of this institution\'s currently published Terms of Service or Privacy Policy',
  })
  @ApiResponse({
    status: 200,
    description:
      'Same shape as platform POST /agreements/:id/accept. Agreement must belong to this tenant.',
  })
  @ApiNotFoundResponse({
    description: 'Institution or agreement not found',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async accept(
    @Req() request: AuthenticatedRequest,
    @Param('tenantIdentifier') tenantIdentifier: string,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<AcceptAgreementResponse> {
    const tenant = await this.tenantService.resolveTenantByIdentifier(
      tenantIdentifier,
      { allowDemoWhenEnabled: true },
    );
    return this.tenantTermsAndConditionsService.accept(
      tenant.tenantId,
      request.user.id,
      id,
      request.ip,
      extractAuditRequestContext(request),
    );
  }
}
