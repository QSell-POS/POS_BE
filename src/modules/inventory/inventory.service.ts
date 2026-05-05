import { Repository, DataSource } from 'typeorm';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InventoryItem } from './entities/inventory-item.entity';
import { InventoryHistory, InventoryMovementType } from './entities/inventory-history.entity';
import { InventoryBatch } from './entities/inventory-batch.entity';
import { StockAdjustmentDto } from './dto/inventory.dto';
import { buildPaginationMeta } from 'src/common/dto/pagination.dto';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryItem)
    private inventoryRepository: Repository<InventoryItem>,
    @InjectRepository(InventoryHistory)
    private historyRepository: Repository<InventoryHistory>,
    @InjectRepository(InventoryBatch)
    private batchRepository: Repository<InventoryBatch>,
    private dataSource: DataSource,
  ) {}

  async getInventory(shopId: string, page = 1, limit = 20) {
    const [rawData, total] = await this.inventoryRepository.findAndCount({
      where: { shopId },
      relations: ['product', 'product.brand', 'product.category', 'product.unit'],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    const data = rawData.map((p) => ({
      id: p.id,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      shopId: p.shopId,
      productId: p.productId,
      quantityOnHand: p.quantityOnHand,
      quantityReserved: p.quantityReserved,
      quantityAvailable: p.quantityAvailable,
      minStockLevel: p.product.minStockLevel,
      maxStockLevel: p.product.maxStockLevel,
      product: {
        name: p.product.name,
        sku: p.product.sku,
        barcode: p.product.barcode,
        brand: p.product.brand?.name,
        category: p.product.category?.name,
        unit: p.product.unit?.symbol,
      },
    }));

    return {
      data,
      message: 'Inventory retrieved successfully',
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  async getInventoryByProduct(productId: string, shopId: string) {
    const item = await this.inventoryRepository.findOne({
      where: { productId, shopId },
      relations: ['product'],
    });
    if (!item) throw new NotFoundException('Inventory item not found');
    return item;
  }

  async getLowStockProducts(shopId: string, page = 1, limit = 20) {
    const qb = this.inventoryRepository
      .createQueryBuilder('inv')
      .leftJoinAndSelect('inv.product', 'product')
      .leftJoinAndSelect('product.brand', 'brand')
      .leftJoinAndSelect('product.unit', 'unit')
      .where('inv.shopId = :shopId', { shopId })
      .andWhere('inv.quantityAvailable <= product.minStockLevel')
      .andWhere('product.trackInventory = true');

    const total = await qb.getCount();
    const data = await qb
      .orderBy('inv.quantityAvailable', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      data,
      message: 'Low stock products retrieved successfully',
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  async adjustStock(dto: StockAdjustmentDto, shopId: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let inventoryItem = await queryRunner.manager.findOne(InventoryItem, {
        where: { variantId: dto.variantId, shopId },
      });

      if (!inventoryItem) {
        inventoryItem = queryRunner.manager.create(InventoryItem, {
          productId: dto.productId,
          variantId: dto.variantId,
          shopId,
          quantityOnHand: 0,
          quantityAvailable: 0,
          quantityReserved: 0,
        });
        inventoryItem = await queryRunner.manager.save(InventoryItem, inventoryItem);
      }

      const quantityBefore = Number(inventoryItem.quantityOnHand);
      const inboundTypes = [
        InventoryMovementType.PURCHASE,
        InventoryMovementType.RETURN_IN,
        InventoryMovementType.ADJUSTMENT_IN,
        InventoryMovementType.TRANSFER_IN,
        InventoryMovementType.OPENING_STOCK,
      ];

      const isInbound = inboundTypes.includes(dto.movementType);
      const quantityChange = isInbound ? dto.quantity : -dto.quantity;
      const quantityAfter = quantityBefore + quantityChange;

      if (quantityAfter < 0) {
        throw new BadRequestException(`Insufficient stock. Available: ${inventoryItem.quantityAvailable}`);
      }

      // Update weighted average cost for inbound
      if (isInbound && dto.unitCost) {
        const totalValue = Number(inventoryItem.quantityOnHand) * Number(inventoryItem.averageCost) + dto.quantity * dto.unitCost;
        inventoryItem.averageCost = quantityAfter > 0 ? totalValue / quantityAfter : dto.unitCost;
      }

      inventoryItem.quantityOnHand = quantityAfter;
      inventoryItem.quantityAvailable = quantityAfter - Number(inventoryItem.quantityReserved);

      if (isInbound) inventoryItem.lastRestockedAt = new Date();
      else inventoryItem.lastSoldAt = new Date();

      await queryRunner.manager.save(InventoryItem, inventoryItem);

      // Record history
      const history = queryRunner.manager.create(InventoryHistory, {
        inventoryItemId: inventoryItem.id,
        productId: dto.productId,
        variantId: dto.variantId,
        movementType: dto.movementType,
        quantity: dto.quantity,
        quantityBefore,
        quantityAfter,
        unitCost: dto.unitCost,
        referenceId: dto.referenceId,
        referenceType: dto.referenceType,
        notes: dto.notes,
        performedByUserId: dto.performedBy,
        shopId,
      });
      await queryRunner.manager.save(InventoryHistory, history);

      // Deduct from batches FIFO for outbound movements (purchase return to supplier)
      if (dto.movementType === InventoryMovementType.RETURN_OUT) {
        await this.consumeBatchesFIFO(dto.variantId, shopId, dto.quantity, queryRunner);
      }

      // Create inventory batch for inbound movements with a known cost
      const batchInboundTypes = [
        InventoryMovementType.PURCHASE,
        InventoryMovementType.OPENING_STOCK,
        InventoryMovementType.ADJUSTMENT_IN,
        InventoryMovementType.RETURN_IN,
      ];
      if (batchInboundTypes.includes(dto.movementType) && dto.unitCost) {
        const batch = queryRunner.manager.create(InventoryBatch, {
          productId: dto.productId,
          variantId: dto.variantId,
          purchasePrice: dto.unitCost,
          quantityReceived: dto.quantity,
          quantityRemaining: dto.quantity,
          referenceId: dto.referenceId,
          referenceType: dto.referenceType,
          shopId,
        });
        await queryRunner.manager.save(InventoryBatch, batch);
      }

      await queryRunner.commitTransaction();
      return inventoryItem;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async getBatches(shopId: string, productId?: string, variantId?: string, page = 1, limit = 20) {
    const qb = this.batchRepository
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.product', 'product')
      .leftJoinAndSelect('b.variant', 'variant')
      .where('b.shopId = :shopId', { shopId });

    if (productId) qb.andWhere('b.productId = :productId', { productId });
    if (variantId) qb.andWhere('b.variantId = :variantId', { variantId });

    const total = await qb.getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('b.createdAt', 'ASC')
      .getMany();

    return {
      data,
      message: 'Inventory batches retrieved successfully',
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  /**
   * Consume inventory batches using FIFO and return total COGS for the quantity sold.   * Updates quantityRemaining in each batch within the provided queryRunner transaction.
   */
  async consumeBatchesFIFO(
    variantId: string,
    shopId: string,
    quantityToConsume: number,
    queryRunner: import('typeorm').QueryRunner,
  ): Promise<number> {
    const batches = await queryRunner.manager.find(InventoryBatch, {
      where: { variantId, shopId },
      order: { createdAt: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });

    let remaining = quantityToConsume;
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

    // If batches are exhausted (no cost data), remaining items have zero cost
    return totalCost;
  }

  async getHistory(
    shopId: string,
    filters: {
      productId?: string;
      movementType?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const { productId, movementType, startDate, endDate, page = 1, limit = 20 } = filters;

    const qb = this.historyRepository
      .createQueryBuilder('h')
      .leftJoinAndSelect('h.product', 'product')
      .leftJoinAndSelect('h.performedByUser', 'performedByUser')
      .where('h.shopId = :shopId', { shopId });

    if (productId) qb.andWhere('h.productId = :productId', { productId });
    if (movementType) qb.andWhere('h.movementType = :movementType', { movementType });
    if (startDate) qb.andWhere('h.createdAt >= :startDate', { startDate });
    if (endDate) qb.andWhere('h.createdAt <= :endDate', { endDate });

    const total = await qb.getCount();
    const rawData = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('h.createdAt', 'DESC')
      .getMany();

    const data = rawData.map(({ performedByUser, ...h }) => ({
      ...h,
      performedBy: performedByUser ? `${performedByUser.firstName} ${performedByUser.lastName}` : null,
    }));

    return {
      data,
      message: 'Inventory history retrieved successfully',
      meta: buildPaginationMeta(total, page, limit),
    };
  }
}
