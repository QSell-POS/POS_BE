import { InventoryService } from './inventory.service';
import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard, Permissions } from 'src/common/guards/auth.guard';
import { Permission } from 'src/common/permissions/permission.enum';
import { UserRole } from '../users/entities/user.entity';
import { AdjustStockDto } from './dto/inventory.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationDto } from 'src/common/dto/pagination.dto';

@ApiBearerAuth()
@ApiTags('Inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @Permissions(Permission.INVENTORY_VIEW)
  @ApiOperation({ summary: 'Get all inventory items' })
  getInventory(@Query() pagination: PaginationDto, @CurrentUser() user: any) {
    return this.inventoryService.getInventory(user.shopId, pagination.page, pagination.limit);
  }

  @Get('low-stock')
  @Permissions(Permission.INVENTORY_VIEW)
  @ApiOperation({ summary: 'Get low stock variants' })
  getLowStock(@Query() pagination: PaginationDto, @CurrentUser() user: any) {
    return this.inventoryService.getLowStockProducts(user.shopId, pagination.page, pagination.limit);
  }

  @Get('history')
  @Permissions(Permission.INVENTORY_VIEW)
  @ApiOperation({ summary: 'Get inventory history' })
  getHistory(@Query() filters: any, @CurrentUser() user: any) {
    return this.inventoryService.getHistory(user.shopId, filters);
  }

  @Get('batches')
  @Permissions(Permission.INVENTORY_VIEW)
  @ApiOperation({ summary: 'Get inventory batches (FIFO cost layers)' })
  getBatches(@Query('variantId') variantId: string, @Query() pagination: PaginationDto, @CurrentUser() user: any) {
    return this.inventoryService.getBatches(user.shopId, undefined, variantId, pagination.page, pagination.limit);
  }

  @Get('variant/:variantId')
  @Permissions(Permission.INVENTORY_VIEW)
  @ApiOperation({ summary: 'Get inventory for a specific variant' })
  getByVariant(@Param('variantId') variantId: string, @CurrentUser() user: any) {
    return this.inventoryService.getInventoryByVariant(variantId, user.shopId);
  }

  @Post('adjust')
  @Permissions(Permission.INVENTORY_ADJUST)
  @ApiOperation({ summary: 'Manually adjust stock for a variant' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  adjustStock(@Body() dto: AdjustStockDto, @CurrentUser() user: any) {
    return this.inventoryService.adjustStock({ ...dto, performedBy: user.id }, user.shopId);
  }
}
