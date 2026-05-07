import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard, CurrentUser, Roles, Permissions } from 'src/common/guards/auth.guard';
import { Permission } from 'src/common/permissions/permission.enum';
import { PlanGuard, RequiresPlan } from 'src/common/plans/plan.guard';
import { UserRole } from 'src/modules/users/entities/user.entity';
import { StockTransferService } from './stock-transfer.service';
import {
  CreateStockTransferDto,
  ReceiveTransferDto,
  StockTransferFilterDto,
} from './dto/stock-transfer.dto';

@ApiTags('Stock Transfers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PlanGuard)
@RequiresPlan('stockTransfer')
@Controller('stock-transfers')
export class StockTransferController {
  constructor(private readonly stockTransferService: StockTransferService) {}

  @Get()
  @Permissions(Permission.INVENTORY_TRANSFER)
  @ApiOperation({ summary: 'List all stock transfers for current shop' })
  findAll(@Query() filters: StockTransferFilterDto, @CurrentUser() user: any) {
    return this.stockTransferService.findAll(user.shopId, filters);
  }

  @Get(':id')
  @Permissions(Permission.INVENTORY_TRANSFER)
  @ApiOperation({ summary: 'Get a single stock transfer by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.stockTransferService.findOne(id, user.shopId);
  }

  @Post()
  @Permissions(Permission.INVENTORY_TRANSFER)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new stock transfer' })
  create(@Body() dto: CreateStockTransferDto, @CurrentUser() user: any) {
    return this.stockTransferService.create(dto, user.shopId, user.id);
  }

  @Patch(':id/send')
  @Permissions(Permission.INVENTORY_TRANSFER)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Mark a transfer as in-transit (send)' })
  send(@Param('id') id: string, @CurrentUser() user: any) {
    return this.stockTransferService.send(id, user.shopId, user.id);
  }

  @Post(':id/receive')
  @Permissions(Permission.INVENTORY_TRANSFER)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Receive a transfer and record quantities' })
  receive(@Param('id') id: string, @Body() dto: ReceiveTransferDto, @CurrentUser() user: any) {
    return this.stockTransferService.receive(id, dto, user.shopId, user.id);
  }

  @Patch(':id/cancel')
  @Permissions(Permission.INVENTORY_TRANSFER)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Cancel a stock transfer' })
  cancel(@Param('id') id: string, @CurrentUser() user: any) {
    return this.stockTransferService.cancel(id, user.shopId, user.id);
  }
}
