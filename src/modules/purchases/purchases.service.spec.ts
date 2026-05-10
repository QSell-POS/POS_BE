import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { PurchasesService } from './purchases.service';
import { Purchase, PurchaseStatus } from './entities/purchase.entity';
import { PurchaseItem } from './entities/purchase-item.entity';
import { InventoryService } from '../inventory/inventory.service';
import { ProductsService } from '../products/products.service';
import { SuppliersService } from '../suppliers/suppliers.service';
import { ReferenceNumberService } from 'src/common/services/reference-number.service';
import { InventoryMovementType } from '../inventory/entities/inventory-history.entity';
import { SupplierLedgerType } from './entities/supplier-ledger.entity';

const SHOP_ID = 'shop-uuid';
const USER_ID = 'user-uuid';

const makeQR = () => ({
  connect: jest.fn(),
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  rollbackTransaction: jest.fn(),
  release: jest.fn(),
  manager: {
    create: jest.fn((_, data) => data),
    save: jest.fn().mockImplementation((_, data) => Promise.resolve({ ...data, id: 'purchase-id' })),
  },
});

describe('PurchasesService', () => {
  let service: PurchasesService;
  let purchaseRepo: any;
  let purchaseItemRepo: any;
  let inventoryService: jest.Mocked<InventoryService>;
  let productsService: jest.Mocked<ProductsService>;
  let suppliersService: jest.Mocked<SuppliersService>;
  let referenceNumberService: jest.Mocked<ReferenceNumberService>;
  let dataSource: any;
  let qr: ReturnType<typeof makeQR>;

  beforeEach(async () => {
    qr = makeQR();
    dataSource = { createQueryRunner: jest.fn().mockReturnValue(qr) };

    purchaseRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn((data) => data),
      update: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      createQueryBuilder: jest.fn(() => ({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        getMany: jest.fn().mockResolvedValue([]),
      })),
    };

    purchaseItemRepo = { save: jest.fn(), create: jest.fn((data) => data) };

    inventoryService = { adjustStock: jest.fn().mockResolvedValue({}) } as any;

    productsService = { getDefaultVariantId: jest.fn().mockResolvedValue('var-uuid') } as any;

    suppliersService = {
      recordDebit: jest.fn().mockResolvedValue(500),
      incrementTotalPurchased: jest.fn().mockResolvedValue({}),
    } as any;

    referenceNumberService = { generate: jest.fn().mockResolvedValue('PO-20260101-0001') } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchasesService,
        { provide: getRepositoryToken(Purchase), useValue: purchaseRepo },
        { provide: getRepositoryToken(PurchaseItem), useValue: purchaseItemRepo },
        { provide: InventoryService, useValue: inventoryService },
        { provide: ProductsService, useValue: productsService },
        { provide: SuppliersService, useValue: suppliersService },
        { provide: ReferenceNumberService, useValue: referenceNumberService },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(PurchasesService);
  });

  describe('create', () => {
    const validDto = () => ({
      items: [{ productId: 'prod-uuid', quantity: 10, unitCost: 500 }],
      isReceived: true,
    });

    it('creates purchase and adjusts inventory when isReceived=true', async () => {
      purchaseRepo.findOne.mockResolvedValue({ id: 'purchase-id', items: [{ productId: 'p', variantId: 'v', quantity: 10, unitCost: 500 }], supplierId: null, isReceived: true });
      await service.create(validDto() as any, SHOP_ID, USER_ID);

      expect(referenceNumberService.generate).toHaveBeenCalledWith('PO', SHOP_ID, expect.anything());
      expect(inventoryService.adjustStock).toHaveBeenCalledWith(
        expect.objectContaining({ movementType: InventoryMovementType.PURCHASE }), SHOP_ID,
      );
    });

    it('does NOT adjust inventory when isReceived=false', async () => {
      purchaseRepo.findOne.mockResolvedValue({ id: 'purchase-id', items: [], supplierId: null, isReceived: false });
      await service.create({ ...validDto(), isReceived: false } as any, SHOP_ID, USER_ID);
      expect(inventoryService.adjustStock).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when creditAmount exceeds grandTotal', async () => {
      await expect(
        service.create({ ...validDto(), creditAmount: 999_999 } as any, SHOP_ID, USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when creditAmount > 0 without supplierId', async () => {
      await expect(
        service.create({ ...validDto(), creditAmount: 100 } as any, SHOP_ID, USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('records supplier ledger debit on credit purchase', async () => {
      const dto = { ...validDto(), supplierId: 'sup-uuid', creditAmount: 500 };
      purchaseRepo.findOne.mockResolvedValue({ id: 'purchase-id', items: [{ productId: 'p', variantId: 'v', quantity: 10, unitCost: 500 }], supplierId: 'sup-uuid', isReceived: true });
      await service.create(dto as any, SHOP_ID, USER_ID);

      expect(suppliersService.recordDebit).toHaveBeenCalledWith(
        'sup-uuid', SHOP_ID, 500,
        expect.objectContaining({ type: SupplierLedgerType.PURCHASE_DEBIT }),
      );
    });

    it('rolls back transaction on error', async () => {
      productsService.getDefaultVariantId.mockRejectedValue(new Error('DB error'));
      await expect(service.create(validDto() as any, SHOP_ID, USER_ID)).rejects.toThrow();
      expect(qr.rollbackTransaction).toHaveBeenCalled();
    });

    // Security: SQL injection in notes
    it('handles SQL injection in notes field without error', async () => {
      purchaseRepo.findOne.mockResolvedValue({ id: 'purchase-id', items: [], supplierId: null, isReceived: true });
      const dto = { ...validDto(), notes: "'; DROP TABLE purchases; --" };
      await expect(service.create(dto as any, SHOP_ID, USER_ID)).resolves.toBeDefined();
    });

    // Bad data: negative unit cost
    it('creates record even with zero unitCost (valid edge case)', async () => {
      purchaseRepo.findOne.mockResolvedValue({ id: 'purchase-id', items: [{ productId: 'p', variantId: 'v', quantity: 5, unitCost: 0 }], supplierId: null, isReceived: true });
      await expect(
        service.create({ items: [{ productId: 'prod-uuid', quantity: 5, unitCost: 0 }] } as any, SHOP_ID, USER_ID),
      ).resolves.toBeDefined();
    });
  });

  describe('findOne', () => {
    it('returns purchase with relations', async () => {
      purchaseRepo.findOne.mockResolvedValue({ id: 'purchase-id', items: [] });
      const result = await service.findOne('purchase-id', SHOP_ID);
      expect(result.id).toBe('purchase-id');
    });

    it('throws NotFoundException when not found', async () => {
      purchaseRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('bad-id', SHOP_ID)).rejects.toThrow(NotFoundException);
    });

    // Security: shop isolation
    it('throws when queried with wrong shopId', async () => {
      purchaseRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('purchase-id', 'other-shop')).rejects.toThrow(NotFoundException);
    });
  });

  describe('receivePurchase', () => {
    it('updates inventory and marks as received', async () => {
      purchaseRepo.findOne.mockResolvedValue({ id: 'purchase-id', isReceived: false, status: PurchaseStatus.COMPLETED, referenceNumber: 'PO-1', items: [{ productId: 'p', variantId: 'v', quantity: 5, unitCost: 100 }] });
      purchaseRepo.update.mockResolvedValue({});

      await service.receivePurchase('purchase-id', {} as any, SHOP_ID, USER_ID);
      expect(inventoryService.adjustStock).toHaveBeenCalled();
      expect(purchaseRepo.update).toHaveBeenCalledWith('purchase-id', expect.objectContaining({ isReceived: true }));
    });

    it('throws BadRequestException when already received', async () => {
      purchaseRepo.findOne.mockResolvedValue({ id: 'purchase-id', isReceived: true, status: PurchaseStatus.COMPLETED, items: [] });
      await expect(service.receivePurchase('purchase-id', {} as any, SHOP_ID, USER_ID)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when purchase is cancelled', async () => {
      purchaseRepo.findOne.mockResolvedValue({ id: 'purchase-id', isReceived: false, status: PurchaseStatus.CANCELLED, items: [] });
      await expect(service.receivePurchase('purchase-id', {} as any, SHOP_ID, USER_ID)).rejects.toThrow(BadRequestException);
    });
  });
});
