import { SalesService } from './sales.service';
import { UserRole } from '../users/entities/user.entity';
import { JwtAuthGuard, CurrentUser, Roles, RolesGuard, Permissions } from 'src/common/guards/auth.guard';
import { Permission } from 'src/common/permissions/permission.enum';
import { Controller, Get, Post, Body, Param, Query, UseGuards, Patch } from '@nestjs/common';
import { CreateSaleDto, CreateSaleReturnDto, SaleFilterDto } from './dto/sale.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Sales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  @Permissions(Permission.SALES_VIEW)
  @ApiOperation({ summary: 'List sales with filters' })
  findAll(@Query() filters: SaleFilterDto, @CurrentUser() user: any) {
    return this.salesService.findAll(filters, user.shopId);
  }

  @Get('returns/all')
  @Permissions(Permission.SALES_VIEW)
  @ApiOperation({ summary: 'List all sale returns' })
  getReturns(@Query('page') page: number, @Query('limit') limit: number, @CurrentUser() user: any) {
    return this.salesService.getReturns(user.shopId, page, limit);
  }

  @Get(':id')
  @Permissions(Permission.SALES_VIEW)
  @ApiOperation({ summary: 'Get sale details by ID' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return { data: await this.salesService.findOne(id, user.shopId) };
  }

  @Post()
  @Permissions(Permission.SALES_CREATE)
  @ApiOperation({ summary: 'Create a new sale (POS transaction)' })
  create(@Body() dto: CreateSaleDto, @CurrentUser() user: any) {
    return this.salesService.create(dto, user.shopId, user.id);
  }

  @Patch(':id/cancel')
  @Permissions(Permission.SALES_VOID)
  @ApiOperation({ summary: 'Cancel a sale and restore inventory' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  cancelSale(@Param('id') id: string, @CurrentUser() user: any) {
    return this.salesService.cancelSale(id, user.shopId, user.id);
  }

  @Post('returns')
  @Permissions(Permission.SALES_RETURN)
  @ApiOperation({ summary: 'Create a sale return' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  createReturn(@Body() dto: CreateSaleReturnDto, @CurrentUser() user: any) {
    return this.salesService.createReturn(dto, user.shopId, user.id);
  }
}
