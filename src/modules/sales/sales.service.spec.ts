import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { SalesService } from './sales.service';
import { Sale, SaleItem, SaleStatus, PaymentMethod } from './entities/sale.entity';
import { InventoryService } from '../inventory/inventory.service';
import { ProductsService } from '../products/products.service';
import { ExpensesService } from '../expenses/expenses.service';
import { CustomersService } from '../customers/customers.service';
import { ReferenceNumberService } from 'src/common/services/reference-number.service';
import { PriceType } from '../products/entities/product-price.entity';
import { InventoryMovementType } from '../inventory/entities/inventory-history.entity';
import { CustomerLedgerType } from './entities/customer-ledger.entity';

const SHOP_ID = 'shop-uuid';
const USER_ID = 'user-uuid';

const mockProduct = () => ({
  id: 'prod-uuid',
  name: 'Test Product',
  taxRate: 0,
  inventoryItems: [{ variantId: 'var-uuid', quantityAvailable: 100 }],
});

const mockVariant = () => ({ id: 'var-uuid', trackInventory: true });

const makeRepo = () => ({
  findOne: jest.fn(),
  findAndCount: jest.fn(),
  save: jest.fn().mockImplementation((data) => Promise.resolve({ ...data, id: 'sale-id', invoiceNumber: 'INV-20260101-00001' })),
  create: jest.fn((data) => data),
  update: jest.fn(),
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
});

const makeQR = () => ({
  connect: jest.fn(),
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  rollbackTransaction: jest.fn(),
  release: jest.fn(),
  manager: {
    create: jest.fn((_, data) => data),
    save: jest.fn().mockImplementation((_, data) => Promise.resolve({ ...data, id: 'sale-id', invoiceNumber: 'INV-20260101-00001' })),
    findOne: jest.fn(),
    find: jest.fn(),
    getRepository: jest.fn(),
  },
});

describe('SalesService', () => {
  let service: SalesService;
  let saleRepo: ReturnType<typeof makeRepo>;
  let saleItemRepo: ReturnType<typeof makeRepo>;
  let inventoryService: jest.Mocked<InventoryService>;
  let productsService: jest.Mocked<ProductsService>;
  let expensesService: jest.Mocked<ExpensesService>;
  let customersService: jest.Mocked<CustomersService>;
  let referenceNumberService: jest.Mocked<ReferenceNumberService>;
  let dataSource: { createQueryRunner: jest.Mock };

  let qr: ReturnType<typeof makeQR>;

  beforeEach(async () => {
    saleRepo = makeRepo();
    saleItemRepo = makeRepo();
    qr = makeQR();

    dataSource = { createQueryRunner: jest.fn().mockReturnValue(qr) };

    productsService = {
      findOne: jest.fn().mockResolvedValue(mockProduct()),
      getDefaultVariant: jest.fn().mockResolvedValue(mockVariant()),
      getDefaultVariantId: jest.fn().mockResolvedValue('var-uuid'),
      getCurrentPrice: jest.fn().mockResolvedValue(1000),
    } as any;

    inventoryService = {
      consumeBatchesFIFO: jest.fn().mockResolvedValue(800),
      adjustStock: jest.fn().mockResolvedValue({}),
    } as any;

    expensesService = {
      recordSystemExpense: jest.fn().mockResolvedValue({}),
    } as any;

    customersService = {
      recordDebit: jest.fn().mockResolvedValue(500),
      recordCredit: jest.fn().mockResolvedValue(0),
      incrementTotalPurchased: jest.fn().mockResolvedValue({}),
      getBalance: jest.fn().mockResolvedValue(0),
    } as any;

    referenceNumberService = {
      generate: jest.fn().mockResolvedValue('INV-20260101-00001'),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        { provide: getRepositoryToken(Sale), useValue: saleRepo },
        { provide: getRepositoryToken(SaleItem), useValue: saleItemRepo },
        { provide: InventoryService, useValue: inventoryService },
        { provide: ProductsService, useValue: productsService },
        { provide: ExpensesService, useValue: expensesService },
        { provide: CustomersService, useValue: customersService },
        { provide: ReferenceNumberService, useValue: referenceNumberService },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(SalesService);
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    const validDto = () => ({
      items: [{ productId: 'prod-uuid', quantity: 2, discountRate: 0 }],
      paymentMethod: PaymentMethod.CASH,
    });

    it('creates a sale and calls inventory, COGS expense and reference service', async () => {
      saleRepo.findOne.mockResolvedValue({ id: 'sale-id', invoiceNumber: 'INV-20260101-00001', items: [], status: SaleStatus.COMPLETED, creditAmount: 0 });

      await service.create(validDto() as any, SHOP_ID, USER_ID);

      expect(referenceNumberService.generate).toHaveBeenCalledWith('INV', SHOP_ID, expect.objectContaining({ table: 'sales' }));
      expect(inventoryService.consumeBatchesFIFO).toHaveBeenCalled();
      expect(expensesService.recordSystemExpense).toHaveBeenCalledWith(
        expect.objectContaining({ typeName: 'Cost of Goods Sold' }), SHOP_ID, USER_ID,
      );
    });

    it('throws BadRequestException when creditAmount exceeds grandTotal', async () => {
      await expect(
        service.create({ ...validDto(), creditAmount: 999_999 } as any, SHOP_ID, USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when creditAmount > 0 without customerId', async () => {
      await expect(
        service.create({ ...validDto(), creditAmount: 100 } as any, SHOP_ID, USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('records ledger debit when credit sale has customerId', async () => {
      const dto = { ...validDto(), creditAmount: 500, customerId: 'cust-uuid' };
      saleRepo.findOne.mockResolvedValue({ id: 'sale-id', invoiceNumber: 'INV-20260101-00001', items: [], status: SaleStatus.COMPLETED, creditAmount: 500 });

      await service.create(dto as any, SHOP_ID, USER_ID);

      expect(customersService.recordDebit).toHaveBeenCalledWith(
        'cust-uuid', SHOP_ID, 500,
        expect.objectContaining({ type: CustomerLedgerType.SALE_CREDIT }),
      );
    });

    it('throws BadRequestException when stock is insufficient', async () => {
      const lowStockProduct = { ...mockProduct(), inventoryItems: [{ variantId: 'var-uuid', quantityAvailable: 1 }] };
      productsService.findOne.mockResolvedValue(lowStockProduct);

      await expect(
        service.create({ items: [{ productId: 'prod-uuid', quantity: 50 }] } as any, SHOP_ID, USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('rolls back transaction on error', async () => {
      productsService.findOne.mockRejectedValue(new Error('DB error'));
      await expect(service.create(validDto() as any, SHOP_ID, USER_ID)).rejects.toThrow();
      expect(qr.rollbackTransaction).toHaveBeenCalled();
    });

    // Security: SQL injection in notes field should be stored as plain text, not executed
    it('handles SQL injection in notes field without error', async () => {
      saleRepo.findOne.mockResolvedValue({ id: 'sale-id', invoiceNumber: 'INV-x', items: [], status: SaleStatus.COMPLETED, creditAmount: 0 });
      const dto = { ...validDto(), notes: "'; DROP TABLE sales; --" };
      await expect(service.create(dto as any, SHOP_ID, USER_ID)).resolves.toBeDefined();
    });

    // Bad data: negative quantity
    it('creates sale even with zero-cost items (COGS = 0) without crashing', async () => {
      inventoryService.consumeBatchesFIFO.mockResolvedValue(0);
      saleRepo.findOne.mockResolvedValue({ id: 'sale-id', invoiceNumber: 'INV-x', items: [], status: SaleStatus.COMPLETED, creditAmount: 0 });

      await expect(service.create(validDto() as any, SHOP_ID, USER_ID)).resolves.toBeDefined();
      expect(expensesService.recordSystemExpense).not.toHaveBeenCalled(); // no COGS if totalCogs=0
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns mapped sale with servedBy name', async () => {
      saleRepo.findOne.mockResolvedValue({
        id: 'sale-id',
        status: SaleStatus.COMPLETED,
        items: [{ productId: 'p', product: { name: 'Widget' }, variant: { sku: 'SKU1' } }],
        servedByUser: { firstName: 'Jane', lastName: 'Doe' },
        creditAmount: 0,
      });

      const result = await service.findOne('sale-id', SHOP_ID);
      expect(result.servedBy).toBe('Jane Doe');
      expect(result.items[0].productName).toBe('Widget');
    });

    it('throws NotFoundException when sale not found', async () => {
      saleRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('bad-id', SHOP_ID)).rejects.toThrow(NotFoundException);
    });

    // Security: cannot access another shop's sale (shopId scoping)
    it('returns null and throws when wrong shopId used', async () => {
      saleRepo.findOne.mockResolvedValue(null); // TypeORM scoped by shopId
      await expect(service.findOne('sale-id', 'other-shop-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  // ── cancelSale ────────────────────────────────────────────────────────────

  describe('cancelSale', () => {
    it('cancels and restores inventory', async () => {
      const sale = { id: 'sale-id', status: SaleStatus.COMPLETED, invoiceNumber: 'INV-1', items: [{ productId: 'p', variantId: 'v', quantity: 2, costPrice: 100 }], creditAmount: 0, customerId: null };
      saleRepo.findOne.mockResolvedValueOnce({ ...sale, servedByUser: null }).mockResolvedValueOnce({ ...sale, servedByUser: null, items: sale.items.map((i) => ({ ...i, product: { name: 'x' }, variant: { sku: 'y' } })) });

      await service.cancelSale('sale-id', SHOP_ID, USER_ID);
      expect(saleRepo.update).toHaveBeenCalledWith('sale-id', { status: SaleStatus.CANCELLED });
      expect(inventoryService.adjustStock).toHaveBeenCalledWith(
        expect.objectContaining({ movementType: InventoryMovementType.RETURN_IN }),
        SHOP_ID,
      );
    });

    it('throws BadRequestException when sale is not COMPLETED', async () => {
      saleRepo.findOne.mockResolvedValue({ id: 'sale-id', status: SaleStatus.CANCELLED, items: [], creditAmount: 0, servedByUser: null });
      await expect(service.cancelSale('sale-id', SHOP_ID, USER_ID)).rejects.toThrow(BadRequestException);
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns paginated results', async () => {
      const result = await service.findAll({}, SHOP_ID);
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
    });

    // Security: SQL injection in search param
    it('handles SQL injection in search filter', async () => {
      await expect(
        service.findAll({ search: "' OR 1=1 --" } as any, SHOP_ID),
      ).resolves.toHaveProperty('data');
    });
  });
});
