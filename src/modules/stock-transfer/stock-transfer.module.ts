import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockTransfer, StockTransferItem } from './entities/stock-transfer.entity';
import { StockTransferService } from './stock-transfer.service';
import { StockTransferController } from './stock-transfer.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { PlanModule } from 'src/common/plans/plan.module';

@Module({
  imports: [TypeOrmModule.forFeature([StockTransfer, StockTransferItem]), InventoryModule, PlanModule],
  controllers: [StockTransferController],
  providers: [StockTransferService],
  exports: [StockTransferService],
})
export class StockTransferModule {}
