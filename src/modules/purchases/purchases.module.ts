import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PurchasesService } from './purchases.service';
import { PurchaseReturnService } from './purchase-return.service';
import { PurchasesController } from './purchases.controller';
import { PurchaseReturn, PurchaseReturnItem } from './entities/purchase-return.entity';
import { InventoryModule } from '../inventory/inventory.module';
import { ProductsModule } from '../products/products.module';
import { PurchaseItem } from './entities/purchase-item.entity';
import { Purchase } from './entities/purchase.entity';
import { ExpensesModule } from '../expenses/expenses.module';
import { SuppliersModule } from '../suppliers/suppliers.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Purchase, PurchaseItem, PurchaseReturn, PurchaseReturnItem]),
    InventoryModule,
    ProductsModule,
    ExpensesModule,
    SuppliersModule,
  ],
  providers: [PurchasesService, PurchaseReturnService],
  controllers: [PurchasesController],
  exports: [PurchasesService, PurchaseReturnService],
})
export class PurchasesModule {}
