import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { extractAuditRequestContext } from '../../../../../core/audit/utils/audit-request-context.util';
import { Permission } from '../../../../auth/shared/decorators/permission.decorator';
import { PERMISSIONS } from '../../../../auth/shared/constants/permissions.constant';
import type { AuthenticatedRequest } from '../../../../auth/shared/guards/permission.guard';
import { CreateAgreementDto } from '../dto/create-agreement.dto';
import { ListAgreementsQueryDto } from '../dto/list-agreements-query.dto';
import { UpdateAgreementDto } from '../dto/update-agreement.dto';
import { UpdateAgreementStatusDto } from '../dto/update-agreement-status.dto';
import {
  TermsAndConditionsService,
  type AgreementResponse,
  type PublicAgreementsResponse,
} from '../services/terms-and-conditions.service';

@ApiTags('System Configurations - Terms and Conditions')
@ApiBearerAuth('bearer')
@Controller('system-configurations/terms-and-conditions')
export class TermsAndConditionsController {
  constructor(
    private readonly termsAndConditionsService: TermsAndConditionsService,
  ) {}

  @Post()
  @Permission(PERMISSIONS.SYSTEM_CONFIGURATIONS.MANAGE)
  @ApiOperation({
    summary: 'Create a draft terms of service or privacy policy version',
  })
  @ApiResponse({ status: 201, description: 'Agreement created as DRAFT' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateAgreementDto,
  ): Promise<AgreementResponse> {
    return this.termsAndConditionsService.create(
      dto,
      extractAuditRequestContext(request),
    );
  }

  @Get()
  @Permission(PERMISSIONS.SYSTEM_CONFIGURATIONS.READ)
  @ApiOperation({
    summary: 'List agreement versions (filter by type and/or status)',
  })
  @ApiResponse({ status: 200, description: 'Agreement list' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  findAll(
    @Query() query: ListAgreementsQueryDto,
  ): Promise<AgreementResponse[]> {
    return this.termsAndConditionsService.findAll(query);
  }

  @Get('current')
  @Permission(PERMISSIONS.SYSTEM_CONFIGURATIONS.READ)
  @ApiOperation({
    summary:
      'Get the currently published Terms of Service and Privacy Policy (staff)',
  })
  @ApiResponse({
    status: 200,
    description:
      'Active published agreements (null when none is published and effective)',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  findCurrent(): Promise<PublicAgreementsResponse> {
    return this.termsAndConditionsService.findPublic();
  }

  @Get(':id')
  @Permission(PERMISSIONS.SYSTEM_CONFIGURATIONS.READ)
  @ApiOperation({ summary: 'Get an agreement version by ID' })
  @ApiResponse({ status: 200, description: 'Agreement found' })
  @ApiNotFoundResponse({ description: 'Agreement not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<AgreementResponse> {
    return this.termsAndConditionsService.findOne(id);
  }

  @Patch(':id/status')
  @Permission(PERMISSIONS.SYSTEM_CONFIGURATIONS.MANAGE)
  @ApiOperation({
    summary:
      'Transition agreement status. Publishing archives any previously published version of the same type. effectiveDate must not be in the future.',
  })
  @ApiResponse({ status: 200, description: 'Agreement status updated' })
  @ApiNotFoundResponse({ description: 'Agreement not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  updateStatus(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAgreementStatusDto,
  ): Promise<AgreementResponse> {
    return this.termsAndConditionsService.updateStatus(
      id,
      dto,
      extractAuditRequestContext(request),
    );
  }

  @Patch(':id')
  @Permission(PERMISSIONS.SYSTEM_CONFIGURATIONS.MANAGE)
  @ApiOperation({
    summary:
      'Update a draft agreement. Published/archived versions are immutable.',
  })
  @ApiResponse({ status: 200, description: 'Agreement updated' })
  @ApiNotFoundResponse({ description: 'Agreement not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAgreementDto,
  ): Promise<AgreementResponse> {
    return this.termsAndConditionsService.update(
      id,
      dto,
      extractAuditRequestContext(request),
    );
  }

  @Delete(':id')
  @Permission(PERMISSIONS.SYSTEM_CONFIGURATIONS.MANAGE)
  @ApiOperation({ summary: 'Delete a draft agreement' })
  @ApiResponse({ status: 200, description: 'Agreement deleted' })
  @ApiNotFoundResponse({ description: 'Agreement not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  async remove(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string }> {
    await this.termsAndConditionsService.remove(
      id,
      extractAuditRequestContext(request),
    );
    return { message: 'Agreement deleted successfully' };
  }
}
