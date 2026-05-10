import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';

import { SaleReturnService } from './sale-return.service';
import { SaleReturn, SaleReturnItem, SaleReturnStatus } from './entities/sale-return.entity';
import { SaleStatus } from './entities/sale.entity';
import { SalesService } from './sales.service';
import { InventoryService } from '../inventory/inventory.service';
import { ProductsService } from '../products/products.service';
import { ExpensesService } from '../expenses/expenses.service';
import { CustomersService } from '../customers/customers.service';
import { ReferenceNumberService } from 'src/common/services/reference-number.service';
import { InventoryMovementType } from '../inventory/entities/inventory-history.entity';
import { CustomerLedgerType } from './entities/customer-ledger.entity';

const SHOP_ID = 'shop-uuid';
const USER_ID = 'user-uuid';

const existingSale = () => ({
  id: 'sale-id',
  status: SaleStatus.COMPLETED,
  customerId: 'cust-uuid',
  invoiceNumber: 'INV-1',
  items: [{ productId: 'prod-uuid', variantId: 'var-uuid', costPrice: 800, quantity: 5, unitPrice: 1000, product: { name: 'P' }, variant: { sku: 'S' } }],
  creditAmount: 0,
  servedByUser: null,
});

describe('SaleReturnService', () => {
  let service: SaleReturnService;
  let returnRepo: any;
  let returnItemRepo: any;
  let salesService: jest.Mocked<SalesService>;
  let inventoryService: jest.Mocked<InventoryService>;
  let productsService: jest.Mocked<ProductsService>;
  let expensesService: jest.Mocked<ExpensesService>;
  let customersService: jest.Mocked<CustomersService>;
  let referenceNumberService: jest.Mocked<ReferenceNumberService>;

  beforeEach(async () => {
    returnRepo = {
      save: jest.fn().mockImplementation((data) => Promise.resolve({ ...data, id: 'ret-id', referenceNumber: 'SRN-20260101-0001' })),
      create: jest.fn((data) => data),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    returnItemRepo = { save: jest.fn().mockResolvedValue([]), create: jest.fn((data) => data) };

    salesService = { findOne: jest.fn().mockResolvedValue(existingSale()) } as any;

    inventoryService = { adjustStock: jest.fn().mockResolvedValue({}) } as any;

    productsService = { getDefaultVariantId: jest.fn().mockResolvedValue('var-uuid') } as any;

    expensesService = { recordSystemExpense: jest.fn().mockResolvedValue({}) } as any;

    customersService = {
      recordCredit: jest.fn().mockResolvedValue(0),
      getBalance: jest.fn().mockResolvedValue(200),
    } as any;

    referenceNumberService = { generate: jest.fn().mockResolvedValue('SRN-20260101-0001') } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SaleReturnService,
        { provide: getRepositoryToken(SaleReturn), useValue: returnRepo },
        { provide: getRepositoryToken(SaleReturnItem), useValue: returnItemRepo },
        { provide: SalesService, useValue: salesService },
        { provide: InventoryService, useValue: inventoryService },
        { provide: ProductsService, useValue: productsService },
        { provide: ExpensesService, useValue: expensesService },
        { provide: CustomersService, useValue: customersService },
        { provide: ReferenceNumberService, useValue: referenceNumberService },
      ],
    }).compile();

    service = module.get(SaleReturnService);
  });

  describe('createReturn', () => {
    const validDto = () => ({
      saleId: 'sale-id',
      items: [{ productId: 'prod-uuid', quantity: 1, unitPrice: 1000 }],
    });

    it('creates return, restores inventory, records expense', async () => {
      await service.createReturn(validDto() as any, SHOP_ID, USER_ID);

      expect(referenceNumberService.generate).toHaveBeenCalledWith('SRN', SHOP_ID, expect.anything());
      expect(inventoryService.adjustStock).toHaveBeenCalledWith(
        expect.objectContaining({ movementType: InventoryMovementType.RETURN_IN }), SHOP_ID,
      );
      expect(expensesService.recordSystemExpense).toHaveBeenCalledWith(
        expect.objectContaining({ typeName: 'Sale Return' }), SHOP_ID, USER_ID,
      );
    });

    it('records customer credit when amountToAccount > 0', async () => {
      const dto = { ...validDto(), amountPaidToCustomer: 0 }; // all goes to account
      await service.createReturn(dto as any, SHOP_ID, USER_ID);

      expect(customersService.recordCredit).toHaveBeenCalledWith(
        'cust-uuid', SHOP_ID, 1000,
        expect.objectContaining({ type: CustomerLedgerType.SALE_RETURN_CREDIT }),
      );
    });

    it('throws BadRequestException when return amount paid exceeds total', async () => {
      const dto = { ...validDto(), amountPaidToCustomer: 99_999 };
      await expect(service.createReturn(dto as any, SHOP_ID, USER_ID)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when trying to return a cancelled sale', async () => {
      salesService.findOne.mockResolvedValue({ ...existingSale(), status: SaleStatus.CANCELLED });
      await expect(service.createReturn(validDto() as any, SHOP_ID, USER_ID)).rejects.toThrow(BadRequestException);
    });

    // Bad data: zero quantity
    it('handles return of zero total (noop expense) without crashing', async () => {
      const dto = { ...validDto(), items: [{ productId: 'prod-uuid', quantity: 0, unitPrice: 0 }], amountPaidToCustomer: 0 };
      await expect(service.createReturn(dto as any, SHOP_ID, USER_ID)).resolves.toBeDefined();
      expect(expensesService.recordSystemExpense).not.toHaveBeenCalled();
    });
  });

  describe('getReturns', () => {
    it('returns paginated returns', async () => {
      const result = await service.getReturns(SHOP_ID);
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
    });
  });
});
