import { ProductsService } from './products.service';

import { UserRole } from '../users/entities/user.entity';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from 'src/common/guards/auth.guard';
import { Get, Post, Body, Param, Delete, UseGuards, Controller, Query, Put, Patch } from '@nestjs/common';
import { CreateProductDto, CreateVariantDto, ProductFilterDto, UpdateProductDto, UpdateProductPriceDto, UpdateVariantDto } from './dto/product.dto';
import { UuidParamPipe } from 'src/common/validator';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

@ApiTags('Products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'Find all products' })
  @ApiQuery({ name: 'filters', required: false, type: () => ProductFilterDto })
  findAll(@Query() filters: ProductFilterDto, @CurrentUser() user: any) {
    return this.productsService.findAll(filters, user.shopId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product by ID' })
  async findOne(@Param('id', UuidParamPipe) id: string, @CurrentUser() user: any) {
    return {
      data: await this.productsService.findOne(id, user.shopId),
    };
  }

  @Get('barcode/:barcode')
  @ApiOperation({ summary: 'Get product by barcode' })
  findByBarcode(@Param('barcode') barcode: string, @CurrentUser() user: any) {
    return this.productsService.findByBarcode(barcode, user.shopId);
  }

  @Get(':id/price-history')
  @ApiOperation({ summary: 'Get price history for a product' })
  getPriceHistory(@Param('id', UuidParamPipe) id: string, @CurrentUser() user: any) {
    return this.productsService.getPriceHistory(id, user.shopId);
  }

  @Post('')
  @ApiOperation({ summary: 'Create a new product' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  create(@Body() dto: CreateProductDto, @CurrentUser() user: any) {
    return this.productsService.create(dto, user.shopId, user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a product' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  update(@Param('id', UuidParamPipe) id: string, @Body() dto: UpdateProductDto, @CurrentUser() user: any) {
    return this.productsService.update(id, dto, user.shopId);
  }

  @Patch(':id/price')
  @ApiOperation({ summary: 'Update product price' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  updatePrice(@Param('id', UuidParamPipe) id: string, @Body() dto: UpdateProductPriceDto, @CurrentUser() user: any) {
    return this.productsService.updatePrice(id, dto, user.shopId, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a product' })
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  remove(@Param('id', UuidParamPipe) id: string, @CurrentUser() user: any) {
    return this.productsService.remove(id, user.shopId);
  }

  @Put(':id/restore')
  @ApiOperation({ summary: 'Restore a soft-deleted product' })
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  restore(@Param('id', UuidParamPipe) id: string, @CurrentUser() user: any) {
    return this.productsService.restore(id, user.shopId);
  }

  @Get(':id/variants')
  @ApiOperation({ summary: 'List variants for a product' })
  getVariants(@Param('id', UuidParamPipe) id: string, @CurrentUser() user: any) {
    return this.productsService.getVariants(id, user.shopId);
  }

  @Post(':id/variants')
  @ApiOperation({ summary: 'Add a variant to a product' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  createVariant(@Param('id', UuidParamPipe) id: string, @Body() dto: CreateVariantDto, @CurrentUser() user: any) {
    return this.productsService.createVariant(id, dto, user.shopId);
  }

  @Put(':id/variants/:variantId')
  @ApiOperation({ summary: 'Update a product variant' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  updateVariant(
    @Param('id', UuidParamPipe) id: string,
    @Param('variantId', UuidParamPipe) variantId: string,
    @Body() dto: UpdateVariantDto,
    @CurrentUser() user: any,
  ) {
    return this.productsService.updateVariant(id, variantId, dto, user.shopId);
  }
}
