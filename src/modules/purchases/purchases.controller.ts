import {
  CreatePurchaseDto,
  CreatePurchaseReturnDto,
  CreateSupplierDto,
  ReceivePurchaseDto,
  RecordPaymentDto,
  UpdateSupplierDto,
} from './dto/purchase.dto';
import { PurchasesService } from './purchases.service';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from 'src/common/guards/auth.guard';
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '../users/entities/user.entity';
import { UuidParamPipe } from 'src/common/validator';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

@ApiTags('Purchases')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  // ── Suppliers ─────────────────────────────────────────────
  @Get('suppliers')
  @ApiOperation({ summary: 'Get suppliers list' })
  @ApiQuery({ name: 'search', required: false, description: 'Search by supplier name or contact' })
  getSuppliers(@Query('search') search: string, @CurrentUser() user: any) {
    return this.purchasesService.getSuppliers(user.shopId, search);
  }

  @Post('suppliers')
  @ApiOperation({ summary: 'Create a new supplier' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  createSupplier(@Body() dto: CreateSupplierDto, @CurrentUser() user: any) {
    return this.purchasesService.createSupplier(dto, user.shopId);
  }

  @Put('suppliers/:id')
  @ApiOperation({ summary: 'Update supplier details' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  updateSupplier(@Param('id', UuidParamPipe) id: string, @Body() dto: UpdateSupplierDto, @CurrentUser() user: any) {
    return this.purchasesService.updateSupplier(id, dto, user.shopId);
  }

  // ── Purchases ─────────────────────────────────────────────
  @Get()
  @ApiOperation({ summary: 'Get all purchases' })
  @ApiQuery({ name: 'filters', required: false, description: 'Filters for the query' })
  findAll(@Query() filters: any, @CurrentUser() user: any) {
    return this.purchasesService.findAll(user.shopId, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific purchase' })
  findOne(@Param('id', UuidParamPipe) id: string, @CurrentUser() user: any) {
    return this.purchasesService.findOne(id, user.shopId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new purchase' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  create(@Body() dto: CreatePurchaseDto, @CurrentUser() user: any) {
    return this.purchasesService.create(dto, user.shopId, user.id);
  }

  @Post(':id/receive')
  @ApiOperation({ summary: 'Receive a purchase' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  receive(@Param('id', UuidParamPipe) id: string, @Body() dto: ReceivePurchaseDto, @CurrentUser() user: any) {
    return this.purchasesService.receivePurchase(id, dto, user.shopId, user.id);
  }

  @Post(':id/payment')
  @ApiOperation({ summary: 'Record a payment for a purchase' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  recordPayment(@Param('id', UuidParamPipe) id: string, @Body() dto: RecordPaymentDto, @CurrentUser() user: any) {
    return this.purchasesService.recordPayment(id, dto.amount, user.shopId);
  }

  // ── Purchase Returns ───────────────────────────────────────
  @Get('returns/all')
  @ApiOperation({ summary: 'Get all purchase returns' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number for pagination' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of items per page' })
  getReturns(@Query('page') page: number, @Query('limit') limit: number, @CurrentUser() user: any) {
    return this.purchasesService.getReturns(user.shopId, page, limit);
  }

  @Post('returns')
  @ApiOperation({ summary: 'Create a new purchase return' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  createReturn(@Body() dto: CreatePurchaseReturnDto, @CurrentUser() user: any) {
    return this.purchasesService.createReturn(dto, user.shopId, user.id);
  }
}
