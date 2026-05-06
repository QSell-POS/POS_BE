import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { ProductPrice } from './entities/product-price.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { Product } from './entities/product.entity';
import { ProductVariant } from './entities/product-variant.entity';
import { PlanModule } from 'src/common/plans/plan.module';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
  imports: [
    TypeOrmModule.forFeature([Product, ProductPrice, InventoryItem, ProductVariant]),
    InventoryModule,
    PlanModule,
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    }),
  ],
})
export class ProductsModule {}
