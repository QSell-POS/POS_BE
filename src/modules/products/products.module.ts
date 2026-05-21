import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { ProductPrice } from './entities/product-price.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { InventoryBatch } from '../inventory/entities/inventory-batch.entity';
import { Product } from './entities/product.entity';
import { ProductVariant } from './entities/product-variant.entity';
import { PlanModule } from 'src/common/modules/plans/plan.module';
import { CommonModule } from 'src/common/common.module';
import { CatalogModule } from '../catalog/catalog.module';
import { Category } from '../categories/entities/category.entity';
import { Brand } from '../brands/entities/brand.entity';
import { Unit } from '../units/entities/unit.entity';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
  imports: [
    TypeOrmModule.forFeature([Product, ProductPrice, InventoryItem, ProductVariant, InventoryBatch, Category, Brand, Unit]),
    InventoryModule,
    PlanModule,
    CommonModule,
    CatalogModule,
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    }),
  ],
})
export class ProductsModule {}
