import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard, Permissions } from 'src/common/guards/auth.guard';
import { Permission } from 'src/common/permissions/permission.enum';
import { UserRole } from '../users/entities/user.entity';
import { CustomersService } from './customers.service';
import { CreateCustomerDto, UpdateCustomerDto, CreateCustomerPaymentDto } from '../sales/dto/sale.dto';

@ApiTags('Customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @Permissions(Permission.CUSTOMERS_VIEW)
  @ApiOperation({ summary: 'Get customers list' })
  findAll(@Query('search') search: string, @Query('page') page: number, @Query('limit') limit: number, @CurrentUser() user: any) {
    return this.customersService.findAll(user.shopId, search, page, limit);
  }

  @Get(':id')
  @Permissions(Permission.CUSTOMERS_VIEW)
  @ApiOperation({ summary: 'Get customer by ID' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return { data: await this.customersService.findOne(id, user.shopId) };
  }

  @Post()
  @Permissions(Permission.CUSTOMERS_CREATE)
  @ApiOperation({ summary: 'Create a customer' })
  create(@Body() dto: CreateCustomerDto, @CurrentUser() user: any) {
    return this.customersService.create(dto, user.shopId);
  }

  @Put(':id')
  @Permissions(Permission.CUSTOMERS_UPDATE)
  @ApiOperation({ summary: 'Update customer' })
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto, @CurrentUser() user: any) {
    return this.customersService.update(id, dto, user.shopId);
  }

  @Get(':id/ledger')
  @Permissions(Permission.CUSTOMERS_LEDGER)
  @ApiOperation({ summary: "Get customer's ledger (credit history)" })
  getLedger(@Param('id') id: string, @Query('page') page: number, @Query('limit') limit: number, @CurrentUser() user: any) {
    return this.customersService.getLedger(id, user.shopId, page, limit);
  }

  @Get(':id/statement')
  @Permissions(Permission.CUSTOMERS_LEDGER)
  @ApiOperation({ summary: "Get customer's full statement with balance" })
  getStatement(@Param('id') id: string, @CurrentUser() user: any) {
    return this.customersService.getStatement(id, user.shopId);
  }

  @Post('payments')
  @Permissions(Permission.CUSTOMERS_PAYMENTS)
  @ApiOperation({ summary: 'Record a customer payment to settle their credit balance' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER, UserRole.SUPER_ADMIN)
  recordPayment(@Body() dto: CreateCustomerPaymentDto, @CurrentUser() user: any) {
    return this.customersService.recordPayment(dto, user.shopId, user.id);
  }
}
