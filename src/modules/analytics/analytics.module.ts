import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sale, SaleItem } from '../sales/entities/sale.entity';
import { SaleReturn } from '../sales/entities/sale-return.entity';
import { Purchase } from '../purchases/entities/purchase.entity';
import { PurchaseReturn } from '../purchases/entities/purchase-return.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { Product } from '../products/entities/product.entity';
import { ProductPrice } from '../products/entities/product-price.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Sale,
      SaleItem,
      SaleReturn,
      Purchase,
      PurchaseReturn,
      InventoryItem,
      Product,
      ProductPrice,
      Expense,
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
