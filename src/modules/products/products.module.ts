import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { ProductPrice } from './entities/product-price.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { Product } from './entities/product.entity';
import { ProductVariant } from './entities/product-variant.entity';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
  imports: [TypeOrmModule.forFeature([Product, ProductPrice, InventoryItem, ProductVariant]), InventoryModule],
})
export class ProductsModule {}
