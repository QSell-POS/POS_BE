import { InventoryService } from './inventory.service';
import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from 'src/common/guards/auth.guard';
import { UserRole } from '../users/entities/user.entity';
import { AdjustStockDto } from './dto/inventory.dto';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

@ApiBearerAuth()
@ApiTags('Inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @ApiOperation({ summary: 'Get all inventory items' })
  @ApiQuery({ name: 'page', required: false, default: 1 })
  @ApiQuery({ name: 'limit', required: false, default: 20 })
  getInventory(@Query('page') page: number, @Query('limit') limit: number, @CurrentUser() user: any) {
    return this.inventoryService.getInventory(user.shopId, page, limit);
  }

  @Get('low-stock')
  @ApiOperation({ summary: 'Get low stock products' })
  getLowStock(@CurrentUser() user: any) {
    return this.inventoryService.getLowStockProducts(user.shopId);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get inventory history' })
  getHistory(@Query() filters: any, @CurrentUser() user: any) {
    return this.inventoryService.getHistory(user.shopId, filters);
  }

  @Get('product/:productId')
  @ApiOperation({ summary: 'Get inventory by product ID' })
  getByProduct(@Param('productId') productId: string, @CurrentUser() user: any) {
    return this.inventoryService.getInventoryByProduct(productId, user.shopId);
  }

  @Post('adjust')
  @ApiOperation({ summary: 'Adjust stock for a product' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  adjustStock(@Body() dto: AdjustStockDto, @CurrentUser() user: any) {
    return this.inventoryService.adjustStock({ ...dto, performedBy: user.id }, user.shopId);
  }
}
