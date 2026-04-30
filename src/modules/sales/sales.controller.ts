import { SalesService } from './sales.service';
import { UserRole } from '../users/entities/user.entity';
import { JwtAuthGuard, CurrentUser, Roles, RolesGuard } from 'src/common/guards/auth.guard';
import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, HttpCode, HttpStatus, Patch } from '@nestjs/common';
import { CreateSaleDto, CreateSaleReturnDto, CreateCustomerDto, UpdateCustomerDto, SaleFilterDto, CreateCustomerPaymentDto } from './dto/sale.dto';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

@ApiTags('Sales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  // ── Customers ─────────────────────────────────────────────
  @Get('customers')
  @ApiOperation({ summary: 'Get customers list' })
  getCustomers(@Query('search') search: string, @Query('page') page: number, @Query('limit') limit: number, @CurrentUser() user: any) {
    return this.salesService.getCustomers(user.shopId, search, page, limit);
  }

  @Get('customers/:id')
  @ApiOperation({ summary: 'Get customer by ID' })
  async getCustomer(@Param('id') id: string, @CurrentUser() user: any) {
    return { data: await this.salesService.getCustomer(id, user.shopId) };
  }

  @Post('customers')
  @ApiOperation({ summary: 'Create a customer' })
  createCustomer(@Body() dto: CreateCustomerDto, @CurrentUser() user: any) {
    return this.salesService.createCustomer(dto, user.shopId);
  }

  @Put('customers/:id')
  @ApiOperation({ summary: 'Update customer' })
  updateCustomer(@Param('id') id: string, @Body() dto: UpdateCustomerDto, @CurrentUser() user: any) {
    return this.salesService.updateCustomer(id, dto, user.shopId);
  }

  @Get('customers/:id/ledger')
  @ApiOperation({ summary: "Get customer's ledger (credit history)" })
  getCustomerLedger(@Param('id') id: string, @Query('page') page: number, @Query('limit') limit: number, @CurrentUser() user: any) {
    return this.salesService.getCustomerLedger(id, user.shopId, page, limit);
  }

  @Get('customers/:id/statement')
  @ApiOperation({ summary: "Get customer's full statement with balance" })
  getCustomerStatement(@Param('id') id: string, @CurrentUser() user: any) {
    return this.salesService.getCustomerStatement(id, user.shopId);
  }

  @Post('customers/payments')
  @ApiOperation({ summary: 'Record a customer payment to settle their credit balance' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER, UserRole.SUPER_ADMIN)
  recordCustomerPayment(@Body() dto: CreateCustomerPaymentDto, @CurrentUser() user: any) {
    return this.salesService.recordCustomerPayment(dto, user.shopId, user.id);
  }

  // ── Sales ──────────────────────────────────────────────────
  @Get()
  @ApiOperation({ summary: 'List sales with filters' })
  findAll(@Query() filters: SaleFilterDto, @CurrentUser() user: any) {
    return this.salesService.findAll(filters, user.shopId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get sale details by ID' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return { data: await this.salesService.findOne(id, user.shopId) };
  }

  @Post()
  @ApiOperation({ summary: 'Create a new sale (POS transaction)' })
  create(@Body() dto: CreateSaleDto, @CurrentUser() user: any) {
    return this.salesService.create(dto, user.shopId, user.id);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a sale and restore inventory' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  cancelSale(@Param('id') id: string, @CurrentUser() user: any) {
    return this.salesService.cancelSale(id, user.shopId, user.id);
  }

  // ── Sale Returns ───────────────────────────────────────────
  @Post('returns')
  @ApiOperation({ summary: 'Create a sale return' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  createReturn(@Body() dto: CreateSaleReturnDto, @CurrentUser() user: any) {
    return this.salesService.createReturn(dto, user.shopId, user.id);
  }

  @Get('returns/all')
  @ApiOperation({ summary: 'List all sale returns' })
  getReturns(@Query('page') page: number, @Query('limit') limit: number, @CurrentUser() user: any) {
    return this.salesService.getReturns(user.shopId, page, limit);
  }
}
