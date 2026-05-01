import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { InventoryItem } from './entities/inventory-item.entity';
import { InventoryHistory } from './entities/inventory-history.entity';
import { InventoryBatch } from './entities/inventory-batch.entity';

@Module({
  imports: [TypeOrmModule.forFeature([InventoryItem, InventoryHistory, InventoryBatch])],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
