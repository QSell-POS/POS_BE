import { Test, TestingModule } from '@nestjs/testing';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { SaleReturnService } from './sale-return.service';
import { JwtAuthGuard, RolesGuard } from 'src/common/guards/auth.guard';

const SHOP_ID = 'shop-uuid';
const USER_ID = 'user-uuid';
const mockUser = { id: USER_ID, shopId: SHOP_ID };

const mockSalesService = () => ({
  findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
  findOne: jest.fn().mockResolvedValue({ id: 'sale-id' }),
  create: jest.fn().mockResolvedValue({ data: { id: 'sale-id' } }),
  cancelSale: jest.fn().mockResolvedValue({ message: 'cancelled' }),
});

const mockSaleReturnService = () => ({
  createReturn: jest.fn().mockResolvedValue({ data: { id: 'return-id' } }),
  getReturns: jest.fn().mockResolvedValue({ data: [], total: 0 }),
});

describe('SalesController', () => {
  let controller: SalesController;
  let salesService: ReturnType<typeof mockSalesService>;
  let saleReturnService: ReturnType<typeof mockSaleReturnService>;

  beforeEach(async () => {
    salesService = mockSalesService();
    saleReturnService = mockSaleReturnService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SalesController],
      providers: [
        { provide: SalesService, useValue: salesService },
        { provide: SaleReturnService, useValue: saleReturnService },
      ],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    controller = module.get(SalesController);
  });

  it('findAll scopes to shopId from user token', async () => {
    await controller.findAll({} as any, mockUser);
    expect(salesService.findAll).toHaveBeenCalledWith({}, SHOP_ID);
  });

  it('findOne returns sale wrapped in data', async () => {
    const result = await controller.findOne('sale-id', mockUser);
    expect(salesService.findOne).toHaveBeenCalledWith('sale-id', SHOP_ID);
    expect(result.data).toBeDefined();
  });

  it('create passes shopId and userId from token', async () => {
    const dto = { customerId: 'c', items: [] };
    await controller.create(dto as any, mockUser);
    expect(salesService.create).toHaveBeenCalledWith(dto, SHOP_ID, USER_ID);
  });

  it('cancelSale delegates with shopId and userId', async () => {
    const result = await controller.cancelSale('sale-id', mockUser);
    expect(salesService.cancelSale).toHaveBeenCalledWith('sale-id', SHOP_ID, USER_ID);
    expect(result.message).toBe('cancelled');
  });

  it('createReturn delegates to saleReturnService', async () => {
    const dto = { saleId: 'sale-id', items: [] };
    await controller.createReturn(dto as any, mockUser);
    expect(saleReturnService.createReturn).toHaveBeenCalledWith(dto, SHOP_ID, USER_ID);
  });

  it('getReturns scopes to shopId from token', async () => {
    await controller.getReturns(1, 10, mockUser);
    expect(saleReturnService.getReturns).toHaveBeenCalledWith(SHOP_ID, 1, 10);
  });

  // Security: shopId always comes from JWT token, not from request body
  it('never trusts shopId from request body — always uses JWT shopId', async () => {
    const dto = { customerId: 'c', items: [], shopId: 'attacker-shop' } as any;
    await controller.create(dto, mockUser);
    expect(salesService.create).toHaveBeenCalledWith(dto, SHOP_ID, USER_ID);
  });
});
