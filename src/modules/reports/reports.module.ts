import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sale, SaleItem } from 'src/modules/sales/entities/sale.entity';
import { InventoryItem } from 'src/modules/inventory/entities/inventory-item.entity';
import { Customer } from 'src/modules/sales/entities/customer.entity';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { PlanModule } from 'src/common/plans/plan.module';

@Module({
  imports: [TypeOrmModule.forFeature([Sale, SaleItem, InventoryItem, Customer]), PlanModule],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
