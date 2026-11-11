import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
import { extractAuditRequestContext } from '../../../core/audit/utils/audit-request-context.util';
import { Permission } from '../../auth/shared/decorators/permission.decorator';
import { PERMISSIONS } from '../../auth/shared/constants/permissions.constant';
import type { AuthenticatedRequest } from '../../auth/shared/guards/permission.guard';
import { resolveCallerTenantId } from '../../roles/shared/utils/resolve-caller-tenant.util';
import { CancelOfferDto } from '../dto/cancel-offer.dto';
import { CreateManualOfferDto } from '../dto/create-manual-offer.dto';
import { ListSpecialOffersQueryDto } from '../dto/list-special-offers-query.dto';
import { RedeemOfferDto } from '../dto/redeem-offer.dto';
import { UpdateOfferConfigDto } from '../dto/update-offer-config.dto';
import {
  SpecialOffersService,
  type SpecialOfferConfigResponse,
  type SpecialOfferResponse,
  type SpecialOffersListResponse,
} from '../services/special-offers.service';

@ApiTags('Special Offers')
@ApiBearerAuth('bearer')
@Controller('special-offers')
export class SpecialOffersController {
  constructor(private readonly specialOffersService: SpecialOffersService) {}

  @Get()
  @Permission(PERMISSIONS.SPECIAL_OFFERS.READ)
  @ApiOperation({
    summary: 'List special offers for staff management (filterable)',
  })
  @ApiResponse({ status: 200, description: 'Paginated special offers' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  findAll(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListSpecialOffersQueryDto,
  ): Promise<SpecialOffersListResponse> {
    return this.specialOffersService.findAll(
      resolveCallerTenantId(request.user),
      query,
    );
  }

  @Get('config')
  @Permission(PERMISSIONS.SPECIAL_OFFERS.READ)
  @ApiOperation({ summary: 'Fetch the special-offer reward configuration' })
  @ApiResponse({ status: 200, description: 'Current reward configuration, or null when not configured' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  getConfig(
    @Req() request: AuthenticatedRequest,
  ): Promise<SpecialOfferConfigResponse | null> {
    return this.specialOffersService.getConfig(
      resolveCallerTenantId(request.user),
    );
  }

  @Patch('config')
  @Permission(PERMISSIONS.SPECIAL_OFFERS.UPDATE)
  @ApiOperation({ summary: 'Update the special-offer reward configuration' })
  @ApiResponse({ status: 200, description: 'Configuration updated' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  updateConfig(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateOfferConfigDto,
  ): Promise<SpecialOfferConfigResponse> {
    return this.specialOffersService.updateConfig(
      resolveCallerTenantId(request.user),
      dto,
      extractAuditRequestContext(request),
    );
  }

  @Post('manual')
  @Permission(PERMISSIONS.SPECIAL_OFFERS.CREATE)
  @ApiOperation({ summary: 'Grant a manual special offer to a customer' })
  @ApiResponse({ status: 201, description: 'Manual offer granted' })
  @ApiNotFoundResponse({ description: 'Target customer not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  grantManualOffer(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateManualOfferDto,
  ): Promise<SpecialOfferResponse> {
    return this.specialOffersService.grantManualOffer(
      request.user.id,
      resolveCallerTenantId(request.user),
      dto,
      extractAuditRequestContext(request),
    );
  }

  @Get('my-offers')
  @Permission(PERMISSIONS.SPECIAL_OFFERS.SELF_READ)
  @ApiOperation({
    summary: 'List active and past special offers for the logged-in customer',
  })
  @ApiResponse({ status: 200, description: 'Customer offers' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  getMyOffers(
    @Req() request: AuthenticatedRequest,
  ): Promise<SpecialOfferResponse[]> {
    return this.specialOffersService.getMyOffers(request.user.id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Permission(PERMISSIONS.SPECIAL_OFFERS.DELETE)
  @ApiOperation({ summary: 'Cancel an issued special offer' })
  @ApiResponse({ status: 200, description: 'Offer cancelled' })
  @ApiNotFoundResponse({ description: 'Offer not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  cancelOffer(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelOfferDto,
  ): Promise<SpecialOfferResponse> {
    return this.specialOffersService.cancelOffer(
      resolveCallerTenantId(request.user),
      id,
      request.user.id,
      dto.cancellationReason,
      extractAuditRequestContext(request),
    );
  }

  @Patch(':id/dismiss-modal')
  @Permission(PERMISSIONS.SPECIAL_OFFERS.SELF_DISMISS)
  @ApiOperation({
    summary: 'Mark the congratulatory offer modal as dismissed',
  })
  @ApiResponse({ status: 200, description: 'Modal dismissed' })
  @ApiNotFoundResponse({ description: 'Offer not found' })
  @ApiForbiddenResponse({ description: 'Offer belongs to another customer' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  dismissModal(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<SpecialOfferResponse> {
    return this.specialOffersService.dismissModal(id, request.user.id);
  }

  @Post(':id/redeem')
  @HttpCode(HttpStatus.OK)
  @Permission(PERMISSIONS.SPECIAL_OFFERS.SELF_REDEEM)
  @ApiOperation({
    summary: 'Validate and redeem a special offer against a loan checkout',
  })
  @ApiResponse({ status: 200, description: 'Offer redeemed' })
  @ApiNotFoundResponse({ description: 'Offer not found' })
  @ApiForbiddenResponse({ description: 'Offer or loan ownership mismatch' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  redeemOffer(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RedeemOfferDto,
  ): Promise<SpecialOfferResponse> {
    return this.specialOffersService.redeemOffer(
      id,
      dto.loanId,
      request.user.id,
      extractAuditRequestContext(request),
    );
  }
}
