import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Sale, SaleStatus } from '../sales/entities/sale.entity';
import { SaleItem } from '../sales/entities/sale.entity';
import { Purchase } from '../purchases/entities/purchase.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { Product } from '../products/entities/product.entity';
import { ProductPrice } from '../products/entities/product-price.entity';
import { Expense } from '../expenses/entities/expense.entity';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Sale)
    private saleRepository: Repository<Sale>,
    @InjectRepository(SaleItem)
    private saleItemRepository: Repository<SaleItem>,
    @InjectRepository(Purchase)
    private purchaseRepository: Repository<Purchase>,
    @InjectRepository(InventoryItem)
    private inventoryRepository: Repository<InventoryItem>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(ProductPrice)
    private priceRepository: Repository<ProductPrice>,
    @InjectRepository(Expense)
    private expenseRepository: Repository<Expense>,
    private dataSource: DataSource,
  ) {}

  // ── Dashboard Overview ────────────────────────────────────
  async getDashboardStats(shopId: string) {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

    const salesAgg = (start: Date) =>
      this.saleRepository
        .createQueryBuilder('s')
        .select('COALESCE(SUM(s.grandTotal),0)', 'revenue')
        .addSelect('COUNT(*)', 'orders')
        .where('s.shopId = :shopId AND s.saleDate BETWEEN :start AND :end AND s.status != :cancelled', {
          shopId,
          start,
          end: now,
          cancelled: SaleStatus.CANCELLED,
        })
        .getRawOne();

    const itemsAgg = (start: Date) =>
      this.saleItemRepository
        .createQueryBuilder('si')
        .innerJoin('si.sale', 's')
        .select('COALESCE(SUM(si.quantity),0)', 'qty')
        .where('s.shopId = :shopId AND s.saleDate BETWEEN :start AND :end AND s.status != :cancelled', {
          shopId,
          start,
          end: now,
          cancelled: SaleStatus.CANCELLED,
        })
        .getRawOne();

    const [todaySales, monthSales, todayItems, monthItems, totalProducts, lowStockCount] = await Promise.all([
      salesAgg(startOfDay),
      salesAgg(startOfMonth),
      itemsAgg(startOfDay),
      itemsAgg(startOfMonth),
      this.productRepository.count({ where: { shopId } }),
      this.inventoryRepository
        .createQueryBuilder('inv')
        .innerJoin('inv.product', 'p')
        .where('inv.shopId = :shopId AND inv.quantityAvailable <= p.minStockLevel AND p.trackInventory = true', { shopId })
        .getCount(),
    ]);

    return {
      revenue: {
        today: Number(todaySales.revenue),
        thisMonth: Number(monthSales.revenue),
      },
      orders: {
        today: Number(todaySales.orders),
        thisMonth: Number(monthSales.orders),
      },
      itemsSold: {
        today: Number(todayItems.qty),
        thisMonth: Number(monthItems.qty),
      },
      inventory: { totalProducts, lowStockCount },
    };
  }

  // ── Sales Chart (weekly = 7 days, monthly = 12 months) ───
  async getSalesChart(shopId: string, period: 'weekly' | 'monthly' = 'weekly') {
    const now = new Date();
    const isWeekly = period === 'weekly';

    const startWindow = isWeekly
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0)
      : new Date(now.getFullYear(), now.getMonth() - 11, 1, 0, 0, 0, 0);
    const endWindow = isWeekly
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const truncate = isWeekly ? 'day' : 'month';

    const rows = await this.saleRepository
      .createQueryBuilder('s')
      .select(`DATE_TRUNC('${truncate}', s.saleDate)`, 'bucket')
      .addSelect('COALESCE(SUM(s.grandTotal),0)', 'revenue')
      .addSelect('COUNT(*)', 'orders')
      .where('s.shopId = :shopId AND s.saleDate BETWEEN :start AND :end AND s.status != :cancelled', {
        shopId,
        start: startWindow,
        end: endWindow,
        cancelled: SaleStatus.CANCELLED,
      })
      .groupBy(`DATE_TRUNC('${truncate}', s.saleDate)`)
      .getRawMany();

    const map = new Map<string, { revenue: number; orders: number }>();
    for (const r of rows) {
      const d = new Date(r.bucket);
      const key = isWeekly
        ? d.toISOString().split('T')[0]
        : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map.set(key, { revenue: Number(r.revenue), orders: Number(r.orders) });
    }

    const data = [];
    if (isWeekly) {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const key = d.toISOString().split('T')[0];
        const entry = map.get(key) ?? { revenue: 0, orders: 0 };
        data.push({
          date: key,
          label: d.toLocaleDateString('en-US', { weekday: 'short' }),
          revenue: entry.revenue,
          orders: entry.orders,
        });
      }
    } else {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const entry = map.get(key) ?? { revenue: 0, orders: 0 };
        data.push({
          date: key,
          label: d.toLocaleDateString('en-US', { month: 'short' }),
          revenue: entry.revenue,
          orders: entry.orders,
        });
      }
    }

    return data;
  }

  // ── Price Fluctuation Chart ───────────────────────────────
  async getPriceFluctuationChart(productId: string, shopId: string) {
    const history = await this.priceRepository
      .createQueryBuilder('pp')
      .select(['pp.priceType', 'pp.price', 'pp.costPrice', 'pp.effectiveFrom', 'pp.reason'])
      .where('pp.productId = :productId AND pp.shopId = :shopId', {
        productId,
        shopId,
      })
      .orderBy('pp.effectiveFrom', 'ASC')
      .getMany();

    // Group by price type
    const grouped: Record<string, any[]> = {};
    for (const h of history) {
      if (!grouped[h.priceType]) grouped[h.priceType] = [];
      grouped[h.priceType].push({
        date: h.effectiveFrom,
        price: Number(h.price),
        costPrice: h.costPrice ? Number(h.costPrice) : null,
        reason: h.reason,
      });
    }
    return grouped;
  }

  // ── Most Selling Products (MVP) ───────────────────────────
  async getMostSellingProducts(shopId: string, limit = 10, startDate?: string, endDate?: string) {
    const qb = this.saleItemRepository
      .createQueryBuilder('si')
      .innerJoin('si.sale', 's', 's.shopId = :shopId AND s.status != :cancelled', {
        shopId,
        cancelled: SaleStatus.CANCELLED,
      })
      .leftJoin('si.product', 'p')
      .leftJoin('p.brand', 'brand')
      .leftJoin('p.category', 'category')
      .leftJoin('p.unit', 'unit')

      .select('p.id', 'productId')
      .addSelect('p.name', 'productName')
      .addSelect('p.sku', 'sku')
      .addSelect('brand.name', 'brandName')
      .addSelect('category.name', 'categoryName')
      .addSelect('unit.symbol', 'unitSymbol')

      .addSelect('SUM(si.quantity)', 'totalQuantity')
      .addSelect('SUM(si.subtotal)', 'totalRevenue')
      .addSelect('SUM(si.profit)', 'totalProfit')
      .addSelect('COUNT(DISTINCT s.id)', 'orderCount')

      .groupBy('p.id')
      .addGroupBy('brand.id')
      .addGroupBy('category.id')
      .addGroupBy('unit.id')

      .orderBy('SUM(si.quantity)', 'DESC')
      .limit(limit);

    if (startDate) qb.andWhere('s.saleDate >= :startDate', { startDate });
    if (endDate) qb.andWhere('s.saleDate <= :endDate', { endDate });

    const rows = await qb.getRawMany();

    return {
      data: rows.map((row) => ({
        productId: row.productId,
        name: row.productName,
        sku: row.sku,
        brandName: row.brandName,
        categoryName: row.categoryName,
        unitSymbol: row.unitSymbol,
        totalQuantity: Number(row.totalQuantity),
        totalRevenue: Number(row.totalRevenue),
        totalProfit: Number(row.totalProfit),
        orderCount: Number(row.orderCount),
      })),
    };
  }

  // ── Least Selling / Slow-Moving Products ─────────────────
  async getSlowMovingProducts(shopId: string, days = 30, limit = 10) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    return this.inventoryRepository
      .createQueryBuilder('inv')
      .leftJoinAndSelect('inv.product', 'product')
      .leftJoinAndSelect('product.brand', 'brand')
      .where('inv.shopId = :shopId', { shopId })
      .andWhere('(inv.lastSoldAt IS NULL OR inv.lastSoldAt < :cutoff)', { cutoff })
      .andWhere('inv.quantityOnHand > 0')
      .orderBy('inv.lastSoldAt', 'ASC', 'NULLS FIRST')
      .limit(limit)
      .getMany();
  }

  // ── Sales Prediction (Linear Regression) ─────────────────
  async getSalesPrediction(shopId: string, futureDays = 7) {
    // Fetch last 90 days of daily sales
    const since = new Date();
    since.setDate(since.getDate() - 90);

    const historicalData = await this.saleRepository
      .createQueryBuilder('s')
      .select("DATE_TRUNC('day', s.saleDate)", 'day')
      .addSelect('COALESCE(SUM(s.grandTotal),0)', 'revenue')
      .where("s.shopId = :shopId AND s.saleDate >= :since AND s.status != 'cancelled'", {
        shopId,
        since,
      })
      .groupBy("DATE_TRUNC('day', s.saleDate)")
      .orderBy('day', 'ASC')
      .getRawMany();

    if (historicalData.length < 7) {
      return { message: 'Insufficient data for prediction', predictions: [] };
    }

    // Simple linear regression
    const n = historicalData.length;
    const xValues = historicalData.map((_, i) => i);
    const yValues = historicalData.map((d) => Number(d.revenue));

    const sumX = xValues.reduce((a, b) => a + b, 0);
    const sumY = yValues.reduce((a, b) => a + b, 0);
    const sumXY = xValues.reduce((acc, x, i) => acc + x * yValues[i], 0);
    const sumXX = xValues.reduce((acc, x) => acc + x * x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Weekly seasonality — calculate average multiplier per day of week
    const dowMap: Record<number, number[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    const avgRevenue = sumY / n;
    historicalData.forEach((d) => {
      const dow = new Date(d.day).getDay();
      dowMap[dow].push(Number(d.revenue));
    });
    const dowMultiplier: Record<number, number> = {};
    for (const dow in dowMap) {
      const vals = dowMap[dow];
      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : avgRevenue;
      dowMultiplier[dow] = avgRevenue > 0 ? avg / avgRevenue : 1;
    }

    const predictions = [];
    const lastDate = new Date(historicalData[historicalData.length - 1].day);
    for (let i = 1; i <= futureDays; i++) {
      const date = new Date(lastDate);
      date.setDate(date.getDate() + i);
      const x = n - 1 + i;
      const trendRevenue = slope * x + intercept;
      const seasonalMultiplier = dowMultiplier[date.getDay()] ?? 1;
      predictions.push({
        date: date.toISOString().split('T')[0],
        predictedRevenue: Math.max(0, Math.round(trendRevenue * seasonalMultiplier * 100) / 100),
        trend: Math.round(trendRevenue * 100) / 100,
      });
    }

    return {
      historicalAverage: Math.round((sumY / n) * 100) / 100,
      trend: slope > 0 ? 'upward' : slope < 0 ? 'downward' : 'flat',
      trendStrength: Math.abs(slope),
      predictions,
    };
  }

  // ── Profit & Loss Report ──────────────────────────────────
  async getProfitLossReport(shopId: string, startDate: string, endDate: string) {
    const [salesData, expenseRows, purchaseData] = await Promise.all([
      this.saleRepository
        .createQueryBuilder('s')
        .select('COALESCE(SUM(s.grandTotal),0)', 'totalRevenue')
        .addSelect('COALESCE(SUM(s.profit),0)', 'grossProfit')
        .addSelect('COALESCE(SUM(s.taxAmount),0)', 'totalTax')
        .addSelect('COALESCE(SUM(s.discountAmount),0)', 'totalDiscount')
        .addSelect('COUNT(*)', 'saleCount')
        .where("s.shopId = :shopId AND s.saleDate BETWEEN :startDate AND :endDate AND s.status != 'cancelled'", {
          shopId,
          startDate,
          endDate,
        })
        .getRawOne(),

      this.expenseRepository
        .createQueryBuilder('e')
        .leftJoin('e.expenseType', 'type')
        .select("COALESCE(type.name, 'uncategorized')", 'category')
        .addSelect('COALESCE(SUM(e.amount),0)', 'total')
        .where('e.shopId = :shopId AND e.transactionDate BETWEEN :startDate AND :endDate', {
          shopId,
          startDate,
          endDate,
        })
        .groupBy('type.name')
        .getRawMany(),

      this.purchaseRepository
        .createQueryBuilder('p')
        .select('COALESCE(SUM(p.grandTotal),0)', 'totalPurchases')
        .where("p.shopId = :shopId AND p.purchaseDate BETWEEN :startDate AND :endDate AND p.status = 'received'", {
          shopId,
          startDate,
          endDate,
        })
        .getRawOne(),
    ]);

    const totalRevenue = Number(salesData.totalRevenue);
    const grossProfit = Number(salesData.grossProfit);
    const totalPurchases = Number(purchaseData.totalPurchases);

    const expenses = expenseRows.reduce(
      (acc, r) => {
        acc[r.category] = Number(r.total);
        return acc;
      },
      {} as Record<string, number>,
    );

    const totalOperatingExpenses = Number(Object.values(expenses).reduce((a: any, b: any) => a + b, 0));
    const netProfit = grossProfit - totalOperatingExpenses;
    const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return {
      period: { startDate, endDate },
      revenue: {
        totalRevenue,
        totalDiscount: Number(salesData.totalDiscount),
        totalTax: Number(salesData.totalTax),
        saleCount: Number(salesData.saleCount),
      },
      costOfGoodsSold: totalPurchases,
      grossProfit,
      grossMargin: Math.round(grossMargin * 100) / 100,
      operatingExpenses: expenses,
      totalOperatingExpenses,
      netProfit,
      netMargin: Math.round(netMargin * 100) / 100,
    };
  }

  // ── Category Performance ──────────────────────────────────
  async getCategoryPerformance(shopId: string, startDate: string, endDate: string) {
    const data = await this.saleItemRepository
      .createQueryBuilder('si')
      .innerJoin('si.sale', 's', "s.shopId = :shopId AND s.saleDate BETWEEN :startDate AND :endDate AND s.status != 'cancelled'", {
        shopId,
        startDate,
        endDate,
      })
      .innerJoin(Product, 'p', 'p.id = si.productId')
      .innerJoin('p.category', 'cat')
      .select('cat.id', 'categoryId')
      .addSelect('cat.name', 'categoryName')
      .addSelect('SUM(si.quantity)', 'totalQuantity')
      .addSelect('SUM(si.subtotal)', 'totalRevenue')
      .addSelect('SUM(si.profit)', 'totalProfit')
      .addSelect('COUNT(DISTINCT s.id)', 'orderCount')
      .groupBy('cat.id, cat.name')
      .orderBy('SUM(si.subtotal)', 'DESC')
      .getRawMany();

    return { data };
  }

  // ── Stock Valuation ───────────────────────────────────────
  async getStockValuation(shopId: string) {
    const rows = await this.inventoryRepository
      .createQueryBuilder('inv')
      .leftJoinAndSelect('inv.product', 'product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.brand', 'brand')
      .where('inv.shopId = :shopId AND inv.quantityOnHand > 0', { shopId })
      .getMany();

    let totalValue = 0;
    const items = rows.map((inv) => {
      const value = Number(inv.quantityOnHand) * Number(inv.averageCost);
      totalValue += value;
      return {
        product: inv.product,
        quantityOnHand: inv.quantityOnHand,
        averageCost: inv.averageCost,
        totalValue: Math.round(value * 100) / 100,
      };
    });

    return {
      items: items.sort((a, b) => b.totalValue - a.totalValue),
      totalStockValue: Math.round(totalValue * 100) / 100,
      totalProducts: items.length,
    };
  }

  // ── Customer Insights ─────────────────────────────────────
  async getTopCustomers(shopId: string, limit = 10, startDate?: string, endDate?: string) {
    const qb = this.saleRepository
      .createQueryBuilder('s')
      .innerJoin('s.customer', 'c')
      .select('c.id', 'customerId')
      .addSelect('c.name', 'customerName')
      .addSelect('c.phone', 'phone')
      .addSelect('SUM(s.grandTotal)', 'totalSpent')
      .addSelect('SUM(s.profit)', 'totalProfit')
      .addSelect('COUNT(*)', 'orderCount')
      .addSelect('AVG(s.grandTotal)', 'avgOrderValue')
      .where("s.shopId = :shopId AND s.status != 'cancelled' AND s.customerId IS NOT NULL", { shopId })
      .groupBy('c.id, c.name, c.phone')
      .orderBy('"totalSpent"', 'DESC')
      .limit(limit);

    if (startDate) qb.andWhere('s.saleDate >= :startDate', { startDate });
    if (endDate) qb.andWhere('s.saleDate <= :endDate', { endDate });

    const rows = await qb.getRawMany();
    return rows.map((r) => ({
      ...r,
      totalSpent: Number(r.totalSpent),
      totalProfit: Number(r.totalProfit),
      orderCount: Number(r.orderCount),
      avgOrderValue: Math.round(Number(r.avgOrderValue) * 100) / 100,
    }));
  }
}
