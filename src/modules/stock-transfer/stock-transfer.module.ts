import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockTransfer, StockTransferItem } from './entities/stock-transfer.entity';
import { StockTransferService } from './stock-transfer.service';
import { StockTransferController } from './stock-transfer.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { ProductsModule } from '../products/products.module';
import { PlanModule } from 'src/common/modules/plans/plan.module';

@Module({
  imports: [TypeOrmModule.forFeature([StockTransfer, StockTransferItem]), InventoryModule, ProductsModule, PlanModule],
  controllers: [StockTransferController],
  providers: [StockTransferService],
  exports: [StockTransferService],
})
export class StockTransferModule {}
