import {
  CreatePurchaseDto,
  CreatePurchaseReturnDto,
  CreateSupplierDto,
  CreateSupplierPaymentDto,
  PurchaseFilterDto,
  PurchaseReturnFilterDto,
  ReceivePurchaseDto,
  SupplierFilterDto,
  UpdateSupplierDto,
} from './dto/purchase.dto';
import { PurchasesService } from './purchases.service';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from 'src/common/guards/auth.guard';
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '../users/entities/user.entity';
import { UuidParamPipe } from 'src/common/validator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Purchases')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  // ── Suppliers ─────────────────────────────────────────────
  @Get('suppliers')
  @ApiOperation({ summary: 'Get suppliers list' })
  getSuppliers(@Query() filters: SupplierFilterDto, @CurrentUser() user: any) {
    return this.purchasesService.getSuppliers(user.shopId, filters);
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

  @Get('suppliers/:id')
  @ApiOperation({ summary: 'Get a supplier by ID' })
  getSupplierById(@Param('id', UuidParamPipe) id: string, @CurrentUser() user: any) {
    return this.purchasesService.getSupplierById(id, user.shopId);
  }

  @Get('suppliers/:id/ledger')
  @ApiOperation({ summary: "Get supplier's ledger" })
  getSupplierLedger(@Param('id', UuidParamPipe) id: string, @Query('page') page: number, @Query('limit') limit: number, @CurrentUser() user: any) {
    return this.purchasesService.getSupplierLedger(id, user.shopId, page, limit);
  }

  @Get('suppliers/:id/statement')
  @ApiOperation({ summary: "Get supplier's full statement with balance" })
  getSupplierStatement(@Param('id', UuidParamPipe) id: string, @CurrentUser() user: any) {
    return this.purchasesService.getSupplierStatement(id, user.shopId);
  }

  @Post('suppliers/payments')
  @ApiOperation({ summary: 'Record a payment to a supplier' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  recordSupplierPayment(@Body() dto: CreateSupplierPaymentDto, @CurrentUser() user: any) {
    return this.purchasesService.recordSupplierPayment(dto, user.shopId, user.id);
  }

  // ── Purchases ─────────────────────────────────────────────
  @Get()
  @ApiOperation({ summary: 'Get all purchases' })
  findAll(@Query() filters: PurchaseFilterDto, @CurrentUser() user: any) {
    return this.purchasesService.findAll(user.shopId, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific purchase' })
  async findOne(@Param('id', UuidParamPipe) id: string, @CurrentUser() user: any) {
    return { data: await this.purchasesService.findOne(id, user.shopId) };
  }

  @Post()
  @ApiOperation({ summary: 'Create a new purchase (isReceived=true updates inventory immediately)' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  create(@Body() dto: CreatePurchaseDto, @CurrentUser() user: any) {
    return this.purchasesService.create(dto, user.shopId, user.id);
  }

  @Patch(':id/receive')
  @ApiOperation({ summary: 'Mark a pending purchase as received and update inventory' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  receive(@Param('id', UuidParamPipe) id: string, @Body() dto: ReceivePurchaseDto, @CurrentUser() user: any) {
    return this.purchasesService.receivePurchase(id, dto, user.shopId, user.id);
  }

  // ── Purchase Returns ───────────────────────────────────────
  @Get('returns/all')
  @ApiOperation({ summary: 'Get all purchase returns' })
  getReturns(@Query() filters: PurchaseReturnFilterDto, @CurrentUser() user: any) {
    return this.purchasesService.getReturns(user.shopId, filters);
  }

  @Post('returns')
  @ApiOperation({ summary: 'Create a new purchase return' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  createReturn(@Body() dto: CreatePurchaseReturnDto, @CurrentUser() user: any) {
    return this.purchasesService.createReturn(dto, user.shopId, user.id);
  }
}
