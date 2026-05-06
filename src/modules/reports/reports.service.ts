import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import { Sale } from 'src/modules/sales/entities/sale.entity';
import { InventoryItem } from 'src/modules/inventory/entities/inventory-item.entity';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Sale)
    private readonly saleRepository: Repository<Sale>,
    @InjectRepository(InventoryItem)
    private readonly inventoryRepository: Repository<InventoryItem>,
  ) {}

  async exportSalesToExcel(
    shopId: string,
    startDate: string,
    endDate: string,
  ): Promise<Buffer> {
    const qb = this.saleRepository
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.customer', 'c')
      .where('s.shopId = :shopId', { shopId })
      .orderBy('s.saleDate', 'DESC');

    if (startDate && endDate) {
      qb.andWhere('s.saleDate BETWEEN :startDate AND :endDate', { startDate, endDate });
    } else if (startDate) {
      qb.andWhere('s.saleDate >= :startDate', { startDate });
    } else if (endDate) {
      qb.andWhere('s.saleDate <= :endDate', { endDate });
    }

    const sales = await qb.getMany();

    const rows = sales.map((s) => ({
      Invoice: s.invoiceNumber,
      Date: s.saleDate,
      Customer: s.customer?.name || 'Walk-in',
      Subtotal: Number(s.subtotal),
      Tax: Number(s.taxAmount),
      Discount: Number(s.discountAmount),
      'Grand Total': Number(s.grandTotal),
      Paid: Number(s.grandTotal) - Number(s.creditAmount),
      Due: Number(s.creditAmount),
      'Payment Status': Number(s.creditAmount) > 0 ? 'partial' : 'paid',
      Status: s.status,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sales');
    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }

  async exportInventoryToExcel(shopId: string): Promise<Buffer> {
    const items = await this.inventoryRepository
      .createQueryBuilder('inv')
      .leftJoinAndSelect('inv.product', 'p')
      .leftJoinAndSelect('inv.variant', 'v')
      .where('inv.shopId = :shopId', { shopId })
      .orderBy('p.name', 'ASC')
      .getMany();

    const rows = items.map((inv) => ({
      'Product Name': inv.product?.name || 'Unknown',
      SKU: inv.variant?.sku || '',
      'Quantity On Hand': Number(inv.quantityOnHand),
      'Quantity Reserved': Number(inv.quantityReserved),
      'Quantity Available': Number(inv.quantityAvailable),
      'Average Cost': Number(inv.averageCost),
      Location: inv.location || '',
      'Last Restocked': inv.lastRestockedAt || '',
      'Last Sold': inv.lastSoldAt || '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }
}
