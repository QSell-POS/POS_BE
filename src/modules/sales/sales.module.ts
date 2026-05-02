import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sale, SaleItem } from './entities/sale.entity';
import { SaleReturn, SaleReturnItem } from './entities/sale-return.entity';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { ProductsModule } from '../products/products.module';
import { ExpensesModule } from '../expenses/expenses.module';
import { CustomersModule } from '../customers/customers.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Sale, SaleItem, SaleReturn, SaleReturnItem]),
    InventoryModule,
    ProductsModule,
    ExpensesModule,
    CustomersModule,
  ],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
