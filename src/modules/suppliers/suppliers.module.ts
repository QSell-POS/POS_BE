import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Supplier } from '../purchases/entities/supplier.entity';
import { SupplierLedger } from '../purchases/entities/supplier-ledger.entity';
import { SupplierPayment } from '../purchases/entities/supplier-payment.entity';
import { SuppliersService } from './suppliers.service';
import { SuppliersController } from './suppliers.controller';
import { ExpensesModule } from '../expenses/expenses.module';

@Module({
  imports: [TypeOrmModule.forFeature([Supplier, SupplierLedger, SupplierPayment]), ExpensesModule],
  controllers: [SuppliersController],
  providers: [SuppliersService],
  exports: [SuppliersService],
})
export class SuppliersModule {}
