import {
  CreatePurchaseDto,
  CreatePurchaseReturnDto,
  PurchaseFilterDto,
  PurchaseReturnFilterDto,
  ReceivePurchaseDto,
} from './dto/purchase.dto';
import { PurchasesService } from './purchases.service';
import { PurchaseReturnService } from './purchase-return.service';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard, Permissions } from 'src/common/guards/auth.guard';
import { Permission } from 'src/common/permissions/permission.enum';
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '../users/entities/user.entity';
import { UuidParamPipe } from 'src/common/validator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Purchases')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('purchases')
export class PurchasesController {
  constructor(
    private readonly purchasesService: PurchasesService,
    private readonly purchaseReturnService: PurchaseReturnService,
  ) {}

  @Get()
  @Permissions(Permission.PURCHASES_VIEW)
  @ApiOperation({ summary: 'Get all purchases' })
  findAll(@Query() filters: PurchaseFilterDto, @CurrentUser() user: any) {
    return this.purchasesService.findAll(user.shopId, filters);
  }

  @Get('returns/all')
  @Permissions(Permission.PURCHASES_VIEW)
  @ApiOperation({ summary: 'Get all purchase returns' })
  getReturns(@Query() filters: PurchaseReturnFilterDto, @CurrentUser() user: any) {
    return this.purchaseReturnService.getReturns(user.shopId, filters);
  }

  @Get(':id')
  @Permissions(Permission.PURCHASES_VIEW)
  @ApiOperation({ summary: 'Get a specific purchase' })
  async findOne(@Param('id', UuidParamPipe) id: string, @CurrentUser() user: any) {
    return { data: await this.purchasesService.findOne(id, user.shopId) };
  }

  @Post()
  @Permissions(Permission.PURCHASES_CREATE)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new purchase (isReceived=true updates inventory immediately)' })
  create(@Body() dto: CreatePurchaseDto, @CurrentUser() user: any) {
    return this.purchasesService.create(dto, user.shopId, user.id);
  }

  @Patch(':id/receive')
  @Permissions(Permission.PURCHASES_RECEIVE)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a pending purchase as received and update inventory' })
  receive(@Param('id', UuidParamPipe) id: string, @Body() dto: ReceivePurchaseDto, @CurrentUser() user: any) {
    return this.purchasesService.receivePurchase(id, dto, user.shopId, user.id);
  }

  @Post('returns')
  @Permissions(Permission.PURCHASES_RETURN)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new purchase return' })
  createReturn(@Body() dto: CreatePurchaseReturnDto, @CurrentUser() user: any) {
    return this.purchaseReturnService.createReturn(dto, user.shopId, user.id);
  }
}
