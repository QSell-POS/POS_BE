import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Sale, SaleItem, SaleStatus } from './entities/sale.entity';
import { CustomerLedgerType } from './entities/customer-ledger.entity';
import { CreateSaleDto, SaleFilterDto } from './dto/sale.dto';
import { buildPaginationMeta } from 'src/common/dto/pagination.dto';
import { InventoryService } from '../inventory/inventory.service';
import { InventoryMovementType } from '../inventory/entities/inventory-history.entity';
import { ProductsService } from '../products/products.service';
import { PriceType } from '../products/entities/product-price.entity';
import { ExpensesService } from '../expenses/expenses.service';
import { CustomersService } from '../customers/customers.service';
import { ReferenceNumberService } from 'src/common/services/reference-number.service';

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(Sale)    private saleRepository: Repository<Sale>,
    @InjectRepository(SaleItem) private saleItemRepository: Repository<SaleItem>,
    private readonly customersService: CustomersService,
    private readonly inventoryService: InventoryService,
    private readonly productsService: ProductsService,
    private readonly expensesService: ExpensesService,
    private readonly referenceNumberService: ReferenceNumberService,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateSaleDto, shopId: string, userId: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let subtotal = 0;
      let totalProfit = 0;
      let totalCogs = 0;
      let nonTaxableSubtotal = 0;
      let taxableSubtotal = 0;
      let totalExciseDuty = 0;
      const enrichedItems = [];

      for (const item of dto.items) {
        const variant = await this.productsService.getVariantById(item.variantId, shopId);
        const product = await this.productsService.findOne(variant.productId, shopId);

        const inv = product.inventoryItems?.find((i) => i.variantId === item.variantId) ?? product.inventoryItems?.[0];
        if (variant.trackInventory && inv && Number(inv.quantityAvailable) < item.quantity) {
          throw new BadRequestException(`Insufficient stock for "${product.name}". Available: ${inv.quantityAvailable}`);
        }

        const retailPrice = item.unitPrice ?? (await this.productsService.getCurrentPrice(variant.productId, PriceType.RETAIL, shopId));
        const lineCogs = await this.inventoryService.consumeBatchesFIFO(item.variantId, shopId, item.quantity, queryRunner);
        const costPrice = item.quantity > 0 ? lineCogs / item.quantity : 0;

        const discountAmount = (retailPrice * item.quantity * (item.discountRate || 0)) / 100;
        const lineSubtotal = retailPrice * item.quantity - discountAmount;
        const lineProfit = lineSubtotal - lineCogs;

        // Nepal IRD tax computation
        const isVatExempt = variant.isVatExempt ?? false;
        const exciseDutyType = variant.exciseDutyType ?? 'none';
        const exciseDutyRate = Number(variant.exciseDutyRate ?? 0);

        let lineExciseDuty = 0;
        if (!isVatExempt && exciseDutyType !== 'none') {
          if (exciseDutyType === 'flat_per_unit') {
            lineExciseDuty = exciseDutyRate * item.quantity;
          } else if (exciseDutyType === 'percentage') {
            lineExciseDuty = (lineSubtotal * exciseDutyRate) / 100;
          }
        }

        const lineTaxableBase = isVatExempt ? 0 : lineSubtotal + lineExciseDuty;

        subtotal += lineSubtotal;
        if (isVatExempt) {
          nonTaxableSubtotal += lineSubtotal;
        } else {
          taxableSubtotal += lineSubtotal;
        }
        totalExciseDuty += lineExciseDuty;
        totalProfit += lineProfit;
        totalCogs += lineCogs;

        enrichedItems.push({
          productId: variant.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          unitPrice: retailPrice,
          costPrice,
          taxRate: isVatExempt ? 0 : Number(variant.vatPercentage ?? 13),
          taxAmount: 0, // filled after aggregation below
          exciseDutyAmount: lineExciseDuty,
          vatAmount: 0, // filled after aggregation below
          isVatExempt,
          discountRate: item.discountRate || 0,
          discountAmount,
          subtotal: lineSubtotal,
          profit: lineProfit,
          shopId,
          _taxableBase: lineTaxableBase,
        });
      }

      // IRD rule: apply 13% VAT on the aggregated taxable base (not per-line)
      const vatPercentage = 13;
      const totalVat = Math.round((taxableSubtotal + totalExciseDuty) * vatPercentage) / 100;

      // Distribute VAT proportionally back to each item for record-keeping
      const totalTaxableBase = taxableSubtotal + totalExciseDuty;
      for (const enrichedItem of enrichedItems) {
        if (!enrichedItem.isVatExempt && totalTaxableBase > 0) {
          enrichedItem.vatAmount = Math.round((enrichedItem._taxableBase / totalTaxableBase) * totalVat * 100) / 100;
        }
        enrichedItem.taxAmount = enrichedItem.exciseDutyAmount + enrichedItem.vatAmount;
        delete enrichedItem._taxableBase;
      }

      const totalTax = totalExciseDuty + totalVat;
      const discountAmount = dto.discountAmount || 0;
      const grandTotal = subtotal + totalTax - discountAmount;
      const creditAmount = dto.creditAmount || 0;

      if (creditAmount > grandTotal) throw new BadRequestException('Credit amount cannot exceed grand total');
      if (creditAmount > 0 && !dto.customerId) throw new BadRequestException('A customer must be selected for credit sales');

      const invoiceNumber = await this.referenceNumberService.generate('INV', shopId, {
        table: 'sales',
        dayColumn: 'sale_date',
        padWidth: 5,
      });

      const sale = queryRunner.manager.create(Sale, {
        invoiceNumber,
        customerId: dto.customerId,
        paymentMethod: dto.paymentMethod,
        subtotal,
        taxAmount: totalTax,
        nonTaxableSubtotal,
        taxableSubtotal,
        exciseDutyAmount: totalExciseDuty,
        vatAmount: totalVat,
        discountAmount,
        grandTotal,
        creditAmount,
        profit: totalProfit - discountAmount,
        status: SaleStatus.COMPLETED,
        servedByUserId: userId,
        notes: dto.notes,
        shopId,
      });

      const savedSale = await queryRunner.manager.save(Sale, sale);
      await queryRunner.manager.save(
        SaleItem,
        enrichedItems.map((i) => queryRunner.manager.create(SaleItem, { ...i, saleId: savedSale.id })),
      );
      await queryRunner.commitTransaction();

      // Post-transaction side effects
      for (const item of enrichedItems) {
        await this.inventoryService.adjustStock(
          { productId: item.productId, variantId: item.variantId, quantity: item.quantity, movementType: InventoryMovementType.SALE, unitCost: item.costPrice, referenceId: savedSale.invoiceNumber, referenceType: 'sale', performedBy: userId },
          shopId,
        );
      }

      if (totalCogs > 0) {
        await this.expensesService.recordSystemExpense(
          { typeName: 'Cost of Goods Sold', title: `COGS: ${invoiceNumber}`, amount: totalCogs, referenceId: savedSale.id, referenceType: 'sale' },
          shopId, userId,
        );
      }

      if (creditAmount > 0 && dto.customerId) {
        await this.customersService.recordDebit(dto.customerId, shopId, creditAmount, {
          type: CustomerLedgerType.SALE_CREDIT,
          referenceType: 'sale',
          referenceId: savedSale.id,
          description: `Credit sale: ${invoiceNumber}`,
          createdBy: userId,
        });
      }

      if (dto.customerId) {
        await this.customersService.incrementTotalPurchased(dto.customerId, grandTotal);
      }

      return this.findOne(savedSale.id, shopId);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(filters: SaleFilterDto, shopId: string) {
    const { search, customerId, status, startDate, endDate, page = 1, limit = 20 } = filters;

    const qb = this.saleRepository
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.customer', 'customer')
      .leftJoinAndSelect('s.servedByUser', 'servedByUser')
      .where('s.shopId = :shopId', { shopId });

    if (search) qb.andWhere('s.invoiceNumber ILIKE :search', { search: `%${search}%` });
    if (customerId) qb.andWhere('s.customerId = :customerId', { customerId });
    if (status) qb.andWhere('s.status = :status', { status });
    if (startDate) qb.andWhere('s.saleDate >= :startDate', { startDate });
    if (endDate) qb.andWhere('s.saleDate <= :endDate', { endDate });

    const total = await qb.getCount();
    const rawData = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('s.createdAt', 'DESC')
      .getMany();

    const data = rawData.map(({ servedByUser, ...sale }) => ({
      ...sale,
      servedBy: servedByUser ? `${servedByUser.firstName} ${servedByUser.lastName}` : null,
    }));

    return { data, message: 'Sales fetched successfully', meta: buildPaginationMeta(total, page, limit) };
  }

  async findOne(id: string, shopId: string) {
    const sale = await this.saleRepository.findOne({
      where: { id, shopId },
      relations: ['customer', 'items', 'items.product', 'items.variant', 'servedByUser'],
    });
    if (!sale) throw new NotFoundException('Sale not found');
    const { servedByUser, items, ...rest } = sale;
    const mappedItems = items.map(({ product, variant, ...item }) => ({
      ...item,
      productName: product?.name ?? null,
      productSku: variant?.sku ?? null,
    }));
    return { ...rest, items: mappedItems, servedBy: servedByUser ? `${servedByUser.firstName} ${servedByUser.lastName}` : null };
  }

  async cancelSale(id: string, shopId: string, userId: string) {
    const sale = await this.findOne(id, shopId);
    if (sale.status !== SaleStatus.COMPLETED) {
      throw new BadRequestException('Only completed sales can be cancelled');
    }

    await this.saleRepository.update(id, { status: SaleStatus.CANCELLED });

    for (const item of sale.items) {
      await this.inventoryService.adjustStock(
        { productId: item.productId, variantId: item.variantId, quantity: item.quantity, movementType: InventoryMovementType.RETURN_IN, unitCost: Number(item.costPrice), referenceId: sale.invoiceNumber, referenceType: 'sale_cancel', performedBy: userId },
        shopId,
      );
    }

    if (Number(sale.creditAmount) > 0 && sale.customerId) {
      await this.customersService.recordCredit(sale.customerId, shopId, Number(sale.creditAmount), {
        type: CustomerLedgerType.ADJUSTMENT,
        referenceType: 'sale_cancel',
        referenceId: id,
        description: `Sale cancelled: ${sale.invoiceNumber}`,
        createdBy: userId,
      });
    }

    return this.findOne(id, shopId);
  }
}
