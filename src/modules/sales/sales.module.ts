import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sale, SaleItem } from './entities/sale.entity';
import { SaleReturn, SaleReturnItem } from './entities/sale-return.entity';
import { SalesService } from './sales.service';
import { SaleReturnService } from './sale-return.service';
import { SalesController } from './sales.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { ProductsModule } from '../products/products.module';
import { ExpensesModule } from '../expenses/expenses.module';
import { CustomersModule } from '../customers/customers.module';
import { CommonModule } from 'src/common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Sale, SaleItem, SaleReturn, SaleReturnItem]),
    InventoryModule,
    ProductsModule,
    ExpensesModule,
    CustomersModule,
    CommonModule,
  ],
  controllers: [SalesController],
  providers: [SalesService, SaleReturnService],
  exports: [SalesService, SaleReturnService],
})
export class SalesModule {}
