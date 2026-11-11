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
import { extractAuditRequestContext } from '../../../../core/audit/utils/audit-request-context.util';
import { Permission } from '../../../auth/shared/decorators/permission.decorator';
import { PERMISSIONS } from '../../../auth/shared/constants/permissions.constant';
import type { AuthenticatedRequest } from '../../../auth/shared/guards/permission.guard';
import { CreateTicketCategoryDto } from '../dto/create-ticket-category.dto';
import { ListTicketCategoriesQueryDto } from '../dto/list-ticket-categories-query.dto';
import { UpdateTicketCategoryDto } from '../dto/update-ticket-category.dto';
import {
  TicketCategoriesService,
  type TicketCategoryResponse,
} from '../services/ticket-categories.service';

@ApiTags('Support - Categories')
@ApiBearerAuth('bearer')
@Controller('support/categories')
export class TicketCategoriesController {
  constructor(
    private readonly ticketCategoriesService: TicketCategoriesService,
  ) {}

  @Post()
  @Permission(PERMISSIONS.SUPPORT.CATEGORIES_CREATE)
  @ApiOperation({ summary: 'Create a support ticket category' })
  @ApiResponse({ status: 201, description: 'Category created' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateTicketCategoryDto,
  ): Promise<TicketCategoryResponse> {
    return this.ticketCategoriesService.create(
      dto,
      extractAuditRequestContext(request),
    );
  }

  @Get('active')
  @Permission(PERMISSIONS.SUPPORT.CUSTOMER_CREATE)
  @ApiOperation({
    summary:
      'List active ticket categories for customers opening a ticket. Optional ?scope=PLATFORM|TENANT filters contact target.',
  })
  @ApiResponse({ status: 200, description: 'Active category list' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  findActive(
    @Query() query: ListTicketCategoriesQueryDto,
  ): Promise<TicketCategoryResponse[]> {
    return this.ticketCategoriesService.findActive(query.scope);
  }

  @Get()
  @Permission(PERMISSIONS.SUPPORT.CATEGORIES_READ)
  @ApiOperation({
    summary:
      'Platform: list ticket categories (filter by isActive and/or scope)',
  })
  @ApiResponse({ status: 200, description: 'Category list' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  findAll(
    @Query() query: ListTicketCategoriesQueryDto,
  ): Promise<TicketCategoryResponse[]> {
    return this.ticketCategoriesService.findAll(query);
  }

  @Get(':id')
  @Permission(PERMISSIONS.SUPPORT.CATEGORIES_READ)
  @ApiOperation({ summary: 'Get a ticket category by ID' })
  @ApiResponse({ status: 200, description: 'Category found' })
  @ApiNotFoundResponse({ description: 'Category not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<TicketCategoryResponse> {
    return this.ticketCategoriesService.findOne(id);
  }

  @Patch(':id')
  @Permission(PERMISSIONS.SUPPORT.CATEGORIES_UPDATE)
  @ApiOperation({ summary: 'Update a ticket category' })
  @ApiResponse({ status: 200, description: 'Category updated' })
  @ApiNotFoundResponse({ description: 'Category not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTicketCategoryDto,
  ): Promise<TicketCategoryResponse> {
    return this.ticketCategoriesService.update(
      id,
      dto,
      extractAuditRequestContext(request),
    );
  }

  @Delete(':id')
  @Permission(PERMISSIONS.SUPPORT.CATEGORIES_DELETE)
  @ApiOperation({ summary: 'Delete a ticket category' })
  @ApiResponse({ status: 200, description: 'Category deleted' })
  @ApiNotFoundResponse({ description: 'Category not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  async remove(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string }> {
    await this.ticketCategoriesService.remove(
      id,
      extractAuditRequestContext(request),
    );
    return { message: 'Ticket category deleted successfully' };
  }
}
