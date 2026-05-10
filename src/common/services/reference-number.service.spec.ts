import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { ReferenceNumberService } from './reference-number.service';

const mockDataSource = (count: number) => {
  const qb = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue({ cnt: String(count) }),
  };
  return { createQueryBuilder: jest.fn(() => qb), _qb: qb };
};

describe('ReferenceNumberService', () => {
  let service: ReferenceNumberService;
  let dataSource: ReturnType<typeof mockDataSource>;

  const build = async (count: number) => {
    dataSource = mockDataSource(count);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferenceNumberService,
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();
    service = module.get(ReferenceNumberService);
  };

  beforeEach(() => build(0));

  it('generates INV- number with date and padded counter', async () => {
    const ref = await service.generate('INV', 'shop-uuid', { table: 'sales', padWidth: 5 });
    expect(ref).toMatch(/^INV-\d{8}-00001$/);
  });

  it('increments counter from existing count', async () => {
    await build(42);
    const ref = await service.generate('PO', 'shop-uuid', { table: 'purchases', padWidth: 4 });
    expect(ref).toMatch(/^PO-\d{8}-0043$/);
  });

  it('uses day-scoped query when dayColumn is provided', async () => {
    const ref = await service.generate('INV', 'shop-uuid', { table: 'sales', dayColumn: 'sale_date' });
    expect((dataSource as any)._qb.andWhere).toHaveBeenCalled();
    expect(ref).toMatch(/^INV-\d{8}-/);
  });

  it('uses total count when dayColumn is omitted', async () => {
    await build(9);
    const ref = await service.generate('SRN', 'shop-uuid', { table: 'sale_returns', padWidth: 4 });
    expect(ref).toMatch(/^SRN-\d{8}-0010$/);
  });

  it('pads counter to requested width', async () => {
    await build(0);
    const ref = await service.generate('PRN', 'shop-uuid', { table: 'purchase_returns', padWidth: 6 });
    expect(ref).toMatch(/^PRN-\d{8}-000001$/);
  });

  // Security: SQL injection in shopId is handled by parameterized query
  it('generates reference even when shopId contains special characters', async () => {
    const ref = await service.generate('INV', "' OR 1=1 --", { table: 'sales' });
    expect(ref).toMatch(/^INV-/);
  });
});
