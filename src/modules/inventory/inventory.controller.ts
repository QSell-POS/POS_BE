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
  @ApiOperation({ summary: 'Get low stock products' })
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
  @ApiOperation({ summary: 'Get all inventory batches (purchase cost layers for FIFO)' })
  getBatches(@Query('productId') productId: string, @Query('variantId') variantId: string, @Query() pagination: PaginationDto, @CurrentUser() user: any) {
    return this.inventoryService.getBatches(user.shopId, productId, variantId, pagination.page, pagination.limit);
  }

  @Get('batches/product/:productId')
  @Permissions(Permission.INVENTORY_VIEW)
  @ApiOperation({ summary: 'Get inventory batches for a specific product' })
  getBatchesByProduct(@Param('productId') productId: string, @Query() pagination: PaginationDto, @CurrentUser() user: any) {
    return this.inventoryService.getBatches(user.shopId, productId, undefined, pagination.page, pagination.limit);
  }

  @Get('product/:productId')
  @Permissions(Permission.INVENTORY_VIEW)
  @ApiOperation({ summary: 'Get inventory by product ID' })
  getByProduct(@Param('productId') productId: string, @CurrentUser() user: any) {
    return this.inventoryService.getInventoryByProduct(productId, user.shopId);
  }

  @Post('adjust')
  @Permissions(Permission.INVENTORY_ADJUST)
  @ApiOperation({ summary: 'Adjust stock for a product' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  adjustStock(@Body() dto: AdjustStockDto, @CurrentUser() user: any) {
    return this.inventoryService.adjustStock({ ...dto, performedBy: user.id }, user.shopId);
  }
}
