import { FifoCostingStrategy } from './fifo-costing.strategy';
import { InventoryBatch } from 'src/modules/inventory/entities/inventory-batch.entity';

const makeQR = (batches: Partial<InventoryBatch>[]) => ({
  manager: {
    find: jest.fn().mockResolvedValue(batches.map((b) => ({ ...b }))),
    save: jest.fn().mockImplementation((_, data) => Promise.resolve(data)),
  },
});

describe('FifoCostingStrategy', () => {
  let strategy: FifoCostingStrategy;

  beforeEach(() => {
    strategy = new FifoCostingStrategy();
  });

  it('consumes oldest batch first and returns correct COGS', async () => {
    const batches = [
      { id: '1', variantId: 'v', shopId: 's', purchasePrice: 100, quantityRemaining: 5, createdAt: new Date('2026-01-01') },
      { id: '2', variantId: 'v', shopId: 's', purchasePrice: 120, quantityRemaining: 5, createdAt: new Date('2026-01-02') },
    ];
    const qr = makeQR(batches) as any;

    const cost = await strategy.consume('v', 's', 7, qr);
    // 5 * 100 + 2 * 120 = 500 + 240 = 740
    expect(cost).toBe(740);
  });

  it('returns full batch cost when exact quantity matches one batch', async () => {
    const batches = [{ purchasePrice: 200, quantityRemaining: 10 }];
    const qr = makeQR(batches) as any;
    const cost = await strategy.consume('v', 's', 10, qr);
    expect(cost).toBe(2000);
  });

  it('returns 0 cost when no batches exist (exhausted)', async () => {
    const qr = makeQR([]) as any;
    const cost = await strategy.consume('v', 's', 5, qr);
    expect(cost).toBe(0);
  });

  it('skips batches with quantityRemaining = 0', async () => {
    const batches = [
      { purchasePrice: 100, quantityRemaining: 0 },
      { purchasePrice: 150, quantityRemaining: 3 },
    ];
    const qr = makeQR(batches) as any;
    const cost = await strategy.consume('v', 's', 3, qr);
    expect(cost).toBe(450);
  });

  it('handles partial consumption of a batch', async () => {
    const batches = [{ purchasePrice: 80, quantityRemaining: 10 }];
    const qr = makeQR(batches) as any;
    const cost = await strategy.consume('v', 's', 3, qr);
    expect(cost).toBe(240);
    // Remaining should be 7
    expect(qr.manager.save).toHaveBeenCalledWith(
      InventoryBatch,
      expect.objectContaining({ quantityRemaining: 7 }),
    );
  });

  it('handles decimal prices correctly', async () => {
    const batches = [{ purchasePrice: 99.99, quantityRemaining: 2 }];
    const qr = makeQR(batches) as any;
    const cost = await strategy.consume('v', 's', 2, qr);
    expect(cost).toBeCloseTo(199.98, 2);
  });

  // Security / bad data
  it('handles quantity = 0 gracefully and returns 0 cost', async () => {
    const batches = [{ purchasePrice: 100, quantityRemaining: 10 }];
    const qr = makeQR(batches) as any;
    const cost = await strategy.consume('v', 's', 0, qr);
    expect(cost).toBe(0);
    expect(qr.manager.save).not.toHaveBeenCalled();
  });

  it('returns partial cost when batches run out before quantity is satisfied', async () => {
    const batches = [{ purchasePrice: 100, quantityRemaining: 3 }];
    const qr = makeQR(batches) as any;
    const cost = await strategy.consume('v', 's', 10, qr);
    // Only 3 units available at 100 = 300; remaining 7 have zero cost
    expect(cost).toBe(300);
  });
});
