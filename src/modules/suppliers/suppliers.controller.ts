import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from 'src/common/guards/auth.guard';
import { UserRole } from '../users/entities/user.entity';
import { UuidParamPipe } from 'src/common/validator';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto, UpdateSupplierDto, CreateSupplierPaymentDto, SupplierFilterDto } from '../purchases/dto/purchase.dto';

@ApiTags('Suppliers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  @ApiOperation({ summary: 'Get suppliers list' })
  findAll(@Query() filters: SupplierFilterDto, @CurrentUser() user: any) {
    return this.suppliersService.findAll(user.shopId, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a supplier by ID' })
  async findOne(@Param('id', UuidParamPipe) id: string, @CurrentUser() user: any) {
    return { data: await this.suppliersService.findOne(id, user.shopId) };
  }

  @Post()
  @ApiOperation({ summary: 'Create a new supplier' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  create(@Body() dto: CreateSupplierDto, @CurrentUser() user: any) {
    return this.suppliersService.create(dto, user.shopId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update supplier details' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  update(@Param('id', UuidParamPipe) id: string, @Body() dto: UpdateSupplierDto, @CurrentUser() user: any) {
    return this.suppliersService.update(id, dto, user.shopId);
  }

  @Get(':id/ledger')
  @ApiOperation({ summary: "Get supplier's ledger" })
  getLedger(@Param('id', UuidParamPipe) id: string, @Query('page') page: number, @Query('limit') limit: number, @CurrentUser() user: any) {
    return this.suppliersService.getLedger(id, user.shopId, page, limit);
  }

  @Get(':id/statement')
  @ApiOperation({ summary: "Get supplier's full statement with balance" })
  getStatement(@Param('id', UuidParamPipe) id: string, @CurrentUser() user: any) {
    return this.suppliersService.getStatement(id, user.shopId);
  }

  @Post('payments')
  @ApiOperation({ summary: 'Record a payment to a supplier' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  recordPayment(@Body() dto: CreateSupplierPaymentDto, @CurrentUser() user: any) {
    return this.suppliersService.recordPayment(dto, user.shopId, user.id);
  }
}
