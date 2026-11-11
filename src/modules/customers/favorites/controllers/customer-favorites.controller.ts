import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
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
import { PERMISSIONS } from '../../../auth/shared/constants/permissions.constant';
import { CurrentUser } from '../../../auth/shared/decorators/current-user.decorator';
import { Permission } from '../../../auth/shared/decorators/permission.decorator';
import { ListCustomerFavoritesQueryDto } from '../dto/list-customer-favorites-query.dto';
import {
  CustomerFavoritesService,
  type CustomerFavoriteTenantItem,
  type CustomerFavoriteTenantListResponse,
} from '../services/customer-favorites.service';

@ApiTags('Customer Favorites')
@ApiBearerAuth('bearer')
@Controller('customers/favorites')
export class CustomerFavoritesController {
  constructor(
    private readonly customerFavoritesService: CustomerFavoritesService,
  ) {}

  @Get()
  @Permission(PERMISSIONS.CUSTOMER_FAVORITES.READ)
  @ApiOperation({
    summary: 'List my favorited institutions (active brands only)',
  })
  @ApiResponse({ status: 200, description: 'Paginated favorites' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  findAll(
    @CurrentUser() customerId: number,
    @Query() query: ListCustomerFavoritesQueryDto,
  ): Promise<CustomerFavoriteTenantListResponse> {
    return this.customerFavoritesService.findAllForCustomer(customerId, query);
  }

  @Post(':tenantId')
  @Permission(PERMISSIONS.CUSTOMER_FAVORITES.MARK)
  @ApiOperation({
    summary:
      'Mark an institution as favorite (idempotent). Path :tenantId is the public tenant uuid.',
  })
  @ApiResponse({ status: 201, description: 'Favorite created or already existed' })
  @ApiNotFoundResponse({
    description: 'Tenant inactive, soft-deleted, or not found',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  mark(
    @CurrentUser() customerId: number,
    @Param('tenantId') tenantId: string,
  ): Promise<CustomerFavoriteTenantItem> {
    return this.customerFavoritesService.mark(customerId, tenantId);
  }

  @Delete(':tenantId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permission(PERMISSIONS.CUSTOMER_FAVORITES.UNMARK)
  @ApiOperation({
    summary:
      'Remove an institution from favorites (idempotent). Path :tenantId is the public tenant uuid.',
  })
  @ApiResponse({ status: 204, description: 'Favorite removed or already absent' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  async unmark(
    @CurrentUser() customerId: number,
    @Param('tenantId') tenantId: string,
  ): Promise<void> {
    await this.customerFavoritesService.unmark(customerId, tenantId);
  }
}
