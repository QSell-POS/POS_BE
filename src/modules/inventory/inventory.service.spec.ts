import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { InventoryService } from './inventory.service';
import { InventoryItem } from './entities/inventory-item.entity';
import { InventoryHistory, InventoryMovementType } from './entities/inventory-history.entity';
import { InventoryBatch } from './entities/inventory-batch.entity';
import { COSTING_STRATEGY } from 'src/common/costing/costing-strategy.interface';

const SHOP_ID = 'shop-uuid';

const makeQR = (inventoryItem: any) => {
  const manager = {
    create: jest.fn((_, data) => data),
    save: jest.fn().mockImplementation((_, data) => Promise.resolve({ ...data, id: 'id' })),
    findOne: jest.fn().mockResolvedValue(inventoryItem),
    find: jest.fn().mockResolvedValue([]),
  };
  return {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager,
  };
};

describe('InventoryService', () => {
  let service: InventoryService;
  let inventoryRepo: any;
  let historyRepo: any;
  let batchRepo: any;
  let costingStrategy: any;
  let dataSource: any;
  let qr: ReturnType<typeof makeQR>;

  const existingItem = () => ({
    id: 'inv-id',
    productId: 'prod-uuid',
    variantId: 'var-uuid',
    quantityOnHand: 50,
    quantityAvailable: 50,
    quantityReserved: 0,
    averageCost: 100,
    shopId: SHOP_ID,
  });

  beforeEach(async () => {
    qr = makeQR(existingItem());
    dataSource = { createQueryRunner: jest.fn().mockReturnValue(qr) };

    inventoryRepo = {
      findOne: jest.fn().mockResolvedValue(existingItem()),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      createQueryBuilder: jest.fn(() => ({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        getMany: jest.fn().mockResolvedValue([]),
      })),
    };

    historyRepo = { findOne: jest.fn(), findAndCount: jest.fn().mockResolvedValue([[], 0]), createQueryBuilder: jest.fn(() => ({ leftJoinAndSelect: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), take: jest.fn().mockReturnThis(), getCount: jest.fn().mockResolvedValue(0), getMany: jest.fn().mockResolvedValue([]) })) };

    batchRepo = {
      find: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn(() => ({ leftJoinAndSelect: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), take: jest.fn().mockReturnThis(), getCount: jest.fn().mockResolvedValue(0), getMany: jest.fn().mockResolvedValue([]) })),
    };

    costingStrategy = { consume: jest.fn().mockResolvedValue(0) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: getRepositoryToken(InventoryItem), useValue: inventoryRepo },
        { provide: getRepositoryToken(InventoryHistory), useValue: historyRepo },
        { provide: getRepositoryToken(InventoryBatch), useValue: batchRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: COSTING_STRATEGY, useValue: costingStrategy },
      ],
    }).compile();

    service = module.get(InventoryService);
  });

  describe('adjustStock — inbound (PURCHASE)', () => {
    it('increases quantityOnHand and creates history entry', async () => {
      await service.adjustStock({
        productId: 'prod-uuid',
        variantId: 'var-uuid',
        quantity: 10,
        movementType: InventoryMovementType.PURCHASE,
        unitCost: 120,
        referenceId: 'PO-1',
        referenceType: 'purchase',
        performedBy: 'user-uuid',
      }, SHOP_ID);

      expect(qr.manager.save).toHaveBeenCalledWith(InventoryItem, expect.objectContaining({ quantityOnHand: 60 }));
      expect(qr.manager.save).toHaveBeenCalledWith(InventoryHistory, expect.objectContaining({ movementType: InventoryMovementType.PURCHASE }));
      expect(qr.manager.save).toHaveBeenCalledWith(InventoryBatch, expect.objectContaining({ purchasePrice: 120 }));
    });

    it('updates weighted average cost on inbound', async () => {
      // existing: 50 units @ 100 = 5000; adding 10 @ 120 = 1200; avg = 6200/60 ≈ 103.33
      await service.adjustStock({
        productId: 'prod-uuid', variantId: 'var-uuid', quantity: 10,
        movementType: InventoryMovementType.PURCHASE, unitCost: 120, referenceType: 'purchase',
      }, SHOP_ID);

      expect(qr.manager.save).toHaveBeenCalledWith(
        InventoryItem,
        expect.objectContaining({ averageCost: expect.closeTo(103.33, 1) }),
      );
    });

    it('creates new InventoryItem if one does not exist', async () => {
      qr.manager.findOne.mockResolvedValue(null);
      await service.adjustStock({
        productId: 'prod-uuid', variantId: 'new-var', quantity: 5,
        movementType: InventoryMovementType.OPENING_STOCK, unitCost: 50, referenceType: 'seed',
      }, SHOP_ID);

      expect(qr.manager.create).toHaveBeenCalledWith(InventoryItem, expect.objectContaining({ variantId: 'new-var' }));
    });
  });

  describe('adjustStock — outbound (SALE)', () => {
    it('decreases quantityOnHand on SALE movement', async () => {
      await service.adjustStock({
        productId: 'prod-uuid', variantId: 'var-uuid', quantity: 5,
        movementType: InventoryMovementType.SALE, unitCost: 100, referenceType: 'sale',
      }, SHOP_ID);

      expect(qr.manager.save).toHaveBeenCalledWith(InventoryItem, expect.objectContaining({ quantityOnHand: 45 }));
    });

    it('throws BadRequestException when stock would go negative', async () => {
      await expect(
        service.adjustStock({
          productId: 'prod-uuid', variantId: 'var-uuid', quantity: 999,
          movementType: InventoryMovementType.SALE, unitCost: 100, referenceType: 'sale',
        }, SHOP_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('calls costingStrategy.consume on RETURN_OUT movement', async () => {
      await service.adjustStock({
        productId: 'prod-uuid', variantId: 'var-uuid', quantity: 3,
        movementType: InventoryMovementType.RETURN_OUT, unitCost: 100, referenceType: 'purchase_return',
      }, SHOP_ID);

      expect(costingStrategy.consume).toHaveBeenCalledWith('var-uuid', SHOP_ID, 3, qr);
    });

    it('rolls back on error', async () => {
      qr.manager.save.mockRejectedValueOnce(new Error('DB error'));
      await expect(
        service.adjustStock({ productId: 'p', variantId: 'v', quantity: 1, movementType: InventoryMovementType.SALE, referenceType: 'sale' }, SHOP_ID),
      ).rejects.toThrow();
      expect(qr.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('getInventoryByProduct', () => {
    it('returns inventory item', async () => {
      inventoryRepo.findOne.mockResolvedValue(existingItem());
      const item = await service.getInventoryByProduct('prod-uuid', SHOP_ID);
      expect(item.id).toBe('inv-id');
    });

    it('throws NotFoundException when not found', async () => {
      inventoryRepo.findOne.mockResolvedValue(null);
      await expect(service.getInventoryByProduct('bad-id', SHOP_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('consumeBatchesFIFO delegate', () => {
    it('delegates to costingStrategy', async () => {
      costingStrategy.consume.mockResolvedValue(500);
      const result = await service.consumeBatchesFIFO('var-uuid', SHOP_ID, 5, qr as any);
      expect(costingStrategy.consume).toHaveBeenCalledWith('var-uuid', SHOP_ID, 5, qr);
      expect(result).toBe(500);
    });
  });
});
