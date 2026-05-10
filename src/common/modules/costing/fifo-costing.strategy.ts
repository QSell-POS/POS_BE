import { Injectable } from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { InventoryBatch } from 'src/modules/inventory/entities/inventory-batch.entity';
import { ICostingStrategy } from './costing-strategy.interface';

@Injectable()
export class FifoCostingStrategy implements ICostingStrategy {
  async consume(
    variantId: string,
    shopId: string,
    quantity: number,
    queryRunner: QueryRunner,
  ): Promise<number> {
    const batches = await queryRunner.manager.find(InventoryBatch, {
      where: { variantId, shopId },
      order: { createdAt: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });

    let remaining = quantity;
    let totalCost = 0;

    for (const batch of batches) {
      if (remaining <= 0) break;
      const available = Number(batch.quantityRemaining);
      if (available <= 0) continue;

      const consumed = Math.min(available, remaining);
      totalCost += consumed * Number(batch.purchasePrice);
      remaining -= consumed;
      batch.quantityRemaining = available - consumed;
      await queryRunner.manager.save(InventoryBatch, batch);
    }

    // Batches exhausted — remaining units have zero recorded cost
    return totalCost;
  }
}
