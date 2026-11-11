import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { PERMISSIONS } from '../../../auth/shared/constants/permissions.constant';
import { Permission } from '../../../auth/shared/decorators/permission.decorator';
import { ListCustomersQueryDto } from '../dto/list-customers-query.dto';
import {
  CustomerDirectoryService,
  type PaginatedCustomersResponse,
} from '../services/customer-directory.service';

@ApiTags('Customers')
@ApiBearerAuth('bearer')
@Controller('customers')
export class CustomersController {
  constructor(
    private readonly customerDirectoryService: CustomerDirectoryService,
  ) {}

  @Get()
  @Permission(PERMISSIONS.CUSTOMERS.READ)
  @ApiOperation({
    summary:
      'Search/list customers for operational pickers (special offers, loans, activity)',
  })
  @ApiResponse({ status: 200, description: 'Paginated customer list' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  findAll(
    @Query() query: ListCustomersQueryDto,
  ): Promise<PaginatedCustomersResponse> {
    return this.customerDirectoryService.findAll(query);
  }
}
