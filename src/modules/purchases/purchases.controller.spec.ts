import { Test, TestingModule } from '@nestjs/testing';
import { PurchasesController } from './purchases.controller';
import { PurchasesService } from './purchases.service';
import { PurchaseReturnService } from './purchase-return.service';
import { JwtAuthGuard, RolesGuard } from 'src/common/guards/auth.guard';

const SHOP_ID = 'shop-uuid';
const USER_ID = 'user-uuid';
const mockUser = { id: USER_ID, shopId: SHOP_ID };

const mockPurchasesService = () => ({
  findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
  findOne: jest.fn().mockResolvedValue({ id: 'po-id' }),
  create: jest.fn().mockResolvedValue({ data: { id: 'po-id' } }),
  receivePurchase: jest.fn().mockResolvedValue({ data: { id: 'po-id' } }),
});

const mockPurchaseReturnService = () => ({
  createReturn: jest.fn().mockResolvedValue({ data: { id: 'prn-id' } }),
  getReturns: jest.fn().mockResolvedValue({ data: [], total: 0 }),
});

describe('PurchasesController', () => {
  let controller: PurchasesController;
  let purchasesService: ReturnType<typeof mockPurchasesService>;
  let purchaseReturnService: ReturnType<typeof mockPurchaseReturnService>;

  beforeEach(async () => {
    purchasesService = mockPurchasesService();
    purchaseReturnService = mockPurchaseReturnService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PurchasesController],
      providers: [
        { provide: PurchasesService, useValue: purchasesService },
        { provide: PurchaseReturnService, useValue: purchaseReturnService },
      ],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    controller = module.get(PurchasesController);
  });

  it('findAll scopes to shopId from JWT', async () => {
    await controller.findAll({} as any, mockUser);
    expect(purchasesService.findAll).toHaveBeenCalledWith(SHOP_ID, {});
  });

  it('findOne returns purchase wrapped in data', async () => {
    const result = await controller.findOne('po-id', mockUser);
    expect(purchasesService.findOne).toHaveBeenCalledWith('po-id', SHOP_ID);
    expect(result.data).toBeDefined();
  });

  it('create delegates with shopId and userId from JWT', async () => {
    const dto = { supplierId: 's', items: [], isReceived: false };
    await controller.create(dto as any, mockUser);
    expect(purchasesService.create).toHaveBeenCalledWith(dto, SHOP_ID, USER_ID);
  });

  it('receive delegates with shopId and userId from JWT', async () => {
    const dto = { items: [] };
    await controller.receive('po-id', dto as any, mockUser);
    expect(purchasesService.receivePurchase).toHaveBeenCalledWith('po-id', dto, SHOP_ID, USER_ID);
  });

  it('createReturn delegates to purchaseReturnService', async () => {
    const dto = { purchaseId: 'po-id', items: [] };
    await controller.createReturn(dto as any, mockUser);
    expect(purchaseReturnService.createReturn).toHaveBeenCalledWith(dto, SHOP_ID, USER_ID);
  });

  it('getReturns scopes to shopId from JWT', async () => {
    await controller.getReturns({} as any, mockUser);
    expect(purchaseReturnService.getReturns).toHaveBeenCalledWith(SHOP_ID, {});
  });

  // Security: shopId always from JWT, not request
  it('never trusts shopId from request body — always uses JWT shopId', async () => {
    const dto = { supplierId: 's', items: [], shopId: 'attacker-shop' } as any;
    await controller.create(dto, mockUser);
    expect(purchasesService.create).toHaveBeenCalledWith(dto, SHOP_ID, USER_ID);
  });
});
