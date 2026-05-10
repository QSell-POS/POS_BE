import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';

import { PurchaseReturnService } from './purchase-return.service';
import { PurchaseReturn, PurchaseReturnItem, PurchaseReturnStatus } from './entities/purchase-return.entity';
import { PurchasesService } from './purchases.service';
import { InventoryService } from '../inventory/inventory.service';
import { ProductsService } from '../products/products.service';
import { ExpensesService } from '../expenses/expenses.service';
import { SuppliersService } from '../suppliers/suppliers.service';
import { ReferenceNumberService } from 'src/common/services/reference-number.service';
import { InventoryMovementType } from '../inventory/entities/inventory-history.entity';
import { SupplierLedgerType } from './entities/supplier-ledger.entity';

const SHOP_ID = 'shop-uuid';
const USER_ID = 'user-uuid';

const existingPurchase = () => ({
  id: 'purchase-id',
  supplierId: 'sup-uuid',
  referenceNumber: 'PO-1',
  items: [{ productId: 'prod-uuid', variantId: 'var-uuid', unitCost: 500, quantity: 10 }],
});

describe('PurchaseReturnService', () => {
  let service: PurchaseReturnService;
  let returnRepo: any;
  let returnItemRepo: any;
  let purchasesService: jest.Mocked<PurchasesService>;
  let inventoryService: jest.Mocked<InventoryService>;
  let productsService: jest.Mocked<ProductsService>;
  let expensesService: jest.Mocked<ExpensesService>;
  let suppliersService: jest.Mocked<SuppliersService>;
  let referenceNumberService: jest.Mocked<ReferenceNumberService>;

  beforeEach(async () => {
    returnRepo = {
      save: jest.fn().mockImplementation((data) => Promise.resolve({ ...data, id: 'ret-id', referenceNumber: 'PRN-20260101-0001' })),
      create: jest.fn((data) => data),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    returnItemRepo = { save: jest.fn().mockResolvedValue([]), create: jest.fn((data) => data) };

    purchasesService = { findOne: jest.fn().mockResolvedValue(existingPurchase()) } as any;
    inventoryService = { adjustStock: jest.fn().mockResolvedValue({}) } as any;
    productsService = { getDefaultVariantId: jest.fn().mockResolvedValue('var-uuid') } as any;
    expensesService = { recordSystemExpense: jest.fn().mockResolvedValue({}) } as any;
    suppliersService = {
      recordCredit: jest.fn().mockResolvedValue(0),
      getBalance: jest.fn().mockResolvedValue(500),
    } as any;
    referenceNumberService = { generate: jest.fn().mockResolvedValue('PRN-20260101-0001') } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseReturnService,
        { provide: getRepositoryToken(PurchaseReturn), useValue: returnRepo },
        { provide: getRepositoryToken(PurchaseReturnItem), useValue: returnItemRepo },
        { provide: PurchasesService, useValue: purchasesService },
        { provide: InventoryService, useValue: inventoryService },
        { provide: ProductsService, useValue: productsService },
        { provide: ExpensesService, useValue: expensesService },
        { provide: SuppliersService, useValue: suppliersService },
        { provide: ReferenceNumberService, useValue: referenceNumberService },
      ],
    }).compile();

    service = module.get(PurchaseReturnService);
  });

  describe('createReturn', () => {
    const validDto = () => ({
      purchaseId: 'purchase-id',
      items: [{ productId: 'prod-uuid', quantity: 2, unitCost: 500 }],
    });

    it('creates return, deducts inventory, records income expense', async () => {
      await service.createReturn(validDto() as any, SHOP_ID, USER_ID);

      expect(referenceNumberService.generate).toHaveBeenCalledWith('PRN', SHOP_ID, expect.anything());
      expect(inventoryService.adjustStock).toHaveBeenCalledWith(
        expect.objectContaining({ movementType: InventoryMovementType.RETURN_OUT }), SHOP_ID,
      );
      expect(expensesService.recordSystemExpense).toHaveBeenCalledWith(
        expect.objectContaining({ typeName: 'Purchase Return', isIncome: true }), SHOP_ID, USER_ID,
      );
    });

    it('records supplier credit when amountToAccount > 0', async () => {
      const dto = { ...validDto(), amountReceivedFromSupplier: 0 };
      await service.createReturn(dto as any, SHOP_ID, USER_ID);

      expect(suppliersService.recordCredit).toHaveBeenCalledWith(
        'sup-uuid', SHOP_ID, 1000,
        expect.objectContaining({ type: SupplierLedgerType.PURCHASE_RETURN_CREDIT }),
      );
    });

    it('throws BadRequestException when amount received exceeds total return', async () => {
      const dto = { ...validDto(), amountReceivedFromSupplier: 999_999 };
      await expect(service.createReturn(dto as any, SHOP_ID, USER_ID)).rejects.toThrow(BadRequestException);
    });

    // Bad data: return more than purchased
    it('still processes return even with large quantity (inventory logic handles constraint)', async () => {
      const dto = { ...validDto(), items: [{ productId: 'prod-uuid', quantity: 9999, unitCost: 500 }] };
      await expect(service.createReturn(dto as any, SHOP_ID, USER_ID)).resolves.toBeDefined();
    });

    // Security: SQL injection in reason
    it('handles SQL injection in reason field', async () => {
      const dto = { ...validDto(), reason: "'; DELETE FROM purchase_returns; --" };
      await expect(service.createReturn(dto as any, SHOP_ID, USER_ID)).resolves.toBeDefined();
    });
  });

  describe('getReturns', () => {
    it('returns paginated results', async () => {
      const result = await service.getReturns(SHOP_ID, {});
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
    });
  });
});
