import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Expense } from './entities/expense.entity';
import { ExpenseType } from './entities/expense-type.entity';
import { ExpensesService } from './expenses.service';
import { ExpensesController } from './expenses.controller';
import { ExpenseTypesService } from './expense-types.service';
import { ExpenseTypesController } from './expense-types.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Expense, ExpenseType])],
  controllers: [ExpensesController, ExpenseTypesController],
  providers: [ExpensesService, ExpenseTypesService],
  exports: [ExpensesService, ExpenseTypesService],
})
export class ExpensesModule {}
