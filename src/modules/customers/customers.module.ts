import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from '../sales/entities/customer.entity';
import { CustomerLedger } from '../sales/entities/customer-ledger.entity';
import { CustomerPayment } from '../sales/entities/customer-payment.entity';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { ExpensesModule } from '../expenses/expenses.module';

@Module({
  imports: [TypeOrmModule.forFeature([Customer, CustomerLedger, CustomerPayment]), ExpensesModule],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
