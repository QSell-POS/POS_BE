import { Repository, DataSource } from 'typeorm';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InventoryItem } from './entities/inventory-item.entity';
import { InventoryHistory, InventoryMovementType } from './entities/inventory-history.entity';
import { StockAdjustmentDto } from './dto/inventory.dto';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryItem)
    private inventoryRepository: Repository<InventoryItem>,
    @InjectRepository(InventoryHistory)
    private historyRepository: Repository<InventoryHistory>,
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
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
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

  async getLowStockProducts(shopId: string) {
    return this.inventoryRepository
      .createQueryBuilder('inv')
      .leftJoinAndSelect('inv.product', 'product')
      .leftJoinAndSelect('product.brand', 'brand')
      .leftJoinAndSelect('product.unit', 'unit')
      .where('inv.shopId = :shopId', { shopId })
      .andWhere('inv.quantityAvailable <= product.minStockLevel')
      .andWhere('product.trackInventory = true')
      .orderBy('inv.quantityAvailable', 'ASC')
      .getMany();
  }

  async adjustStock(dto: StockAdjustmentDto, shopId: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let inventoryItem = await queryRunner.manager.findOne(InventoryItem, {
        where: { productId: dto.productId, shopId },
      });

      if (!inventoryItem) {
        inventoryItem = queryRunner.manager.create(InventoryItem, {
          productId: dto.productId,
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
        movementType: dto.movementType,
        quantity: dto.quantity,
        quantityBefore,
        quantityAfter,
        unitCost: dto.unitCost,
        referenceId: dto.referenceId,
        referenceType: dto.referenceType,
        notes: dto.notes,
        performedBy: dto.performedBy,
        shopId,
      });
      await queryRunner.manager.save(InventoryHistory, history);

      await queryRunner.commitTransaction();
      return inventoryItem;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
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
      .where('h.shopId = :shopId', { shopId });

    if (productId) qb.andWhere('h.productId = :productId', { productId });
    if (movementType) qb.andWhere('h.movementType = :movementType', { movementType });
    if (startDate) qb.andWhere('h.createdAt >= :startDate', { startDate });
    if (endDate) qb.andWhere('h.createdAt <= :endDate', { endDate });

    const total = await qb.getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('h.createdAt', 'DESC')
      .getMany();

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
