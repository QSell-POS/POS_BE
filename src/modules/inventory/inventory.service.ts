import { Repository, DataSource } from 'typeorm';
import type { QueryRunner } from 'typeorm';
import { BadRequestException, Inject, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InventoryItem } from './entities/inventory-item.entity';
import { InventoryHistory, InventoryMovementType } from './entities/inventory-history.entity';
import { InventoryBatch } from './entities/inventory-batch.entity';
import { ProductVariant } from 'src/modules/products/entities/product-variant.entity';
import { StockAdjustmentDto } from './dto/inventory.dto';
import { buildPaginationMeta } from 'src/common/dto/pagination.dto';
import { COSTING_STRATEGY } from 'src/common/modules/costing/costing-strategy.interface';
import type { ICostingStrategy } from 'src/common/modules/costing/costing-strategy.interface';
import { NotificationService } from 'src/modules/notifications/notification.service';
import { User, UserRole } from 'src/modules/users/entities/user.entity';
import { Shop } from 'src/modules/shops/entities/shop.entity';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    @InjectRepository(InventoryItem)
    private inventoryRepository: Repository<InventoryItem>,
    @InjectRepository(InventoryHistory)
    private historyRepository: Repository<InventoryHistory>,
    @InjectRepository(InventoryBatch)
    private batchRepository: Repository<InventoryBatch>,
    private dataSource: DataSource,
    @Inject(COSTING_STRATEGY) private costingStrategy: ICostingStrategy,
    @Optional() private readonly notificationService: NotificationService,
  ) {}

  async getInventory(shopId: string, page = 1, limit = 20) {
    const [rawData, total] = await this.inventoryRepository.findAndCount({
      where: { shopId },
      relations: ['product', 'product.brand', 'product.category', 'product.unit', 'variant'],
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
      variantId: p.variantId,
      quantityOnHand: p.quantityOnHand,
      quantityReserved: p.quantityReserved,
      quantityAvailable: p.quantityAvailable,
      minStockLevel: p.variant?.minStockLevel ?? null,
      maxStockLevel: p.variant?.maxStockLevel ?? null,
      product: {
        name: p.product.name,
        sku: p.variant?.sku ?? null,
        barcode: p.variant?.barcode ?? null,
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
      .leftJoinAndSelect('inv.variant', 'variant')
      .leftJoinAndSelect('product.brand', 'brand')
      .leftJoinAndSelect('product.unit', 'unit')
      .where('inv.shopId = :shopId', { shopId })
      .andWhere('inv.quantityAvailable <= variant.minStockLevel')
      .andWhere('variant.trackInventory = true');

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

      // Deduct from batches for outbound movements (purchase return to supplier)
      if (dto.movementType === InventoryMovementType.RETURN_OUT) {
        await this.costingStrategy.consume(dto.variantId, shopId, dto.quantity, queryRunner);
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

      // Fire-and-forget low stock alert for outbound movements
      if (!isInbound && this.notificationService) {
        this.checkAndNotifyLowStock(inventoryItem, shopId).catch((err) =>
          this.logger.warn(`Low stock notification failed: ${err?.message}`),
        );
      }

      return inventoryItem;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  private async checkAndNotifyLowStock(inventoryItem: InventoryItem, shopId: string): Promise<void> {
    const variant = await this.dataSource.getRepository(ProductVariant).findOne({
      where: { id: inventoryItem.variantId },
      relations: ['product'],
    });

    if (!variant || !variant.trackInventory || !variant.minStockLevel) return;
    if (Number(inventoryItem.quantityAvailable) > Number(variant.minStockLevel)) return;

    const shop = await this.dataSource.getRepository(Shop).findOne({ where: { id: shopId } });
    if (!shop) return;

    const admin = await this.dataSource.getRepository(User).findOne({
      where: { organizationId: shop.organizationId, role: UserRole.ADMIN },
      select: ['email'],
    });
    if (!admin?.email) return;

    await this.notificationService.notifyLowStock({
      shopId,
      productName: variant.product?.name ?? 'Unknown',
      variantSku: variant.sku,
      current: Number(inventoryItem.quantityAvailable),
      minimum: Number(variant.minStockLevel),
      adminEmail: admin.email,
    });
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

  /** Delegates to the active ICostingStrategy (default: FIFO). */
  consumeBatchesFIFO(
    variantId: string,
    shopId: string,
    quantity: number,
    queryRunner: QueryRunner,
  ): Promise<number> {
    return this.costingStrategy.consume(variantId, shopId, quantity, queryRunner);
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
