import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { StorageService } from 'src/common/services/storage.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SaleReturn, SaleReturnItem, SaleReturnStatus } from './entities/sale-return.entity';
import { CustomerLedgerType } from './entities/customer-ledger.entity';
import { SaleStatus } from './entities/sale.entity';
import { CreateSaleReturnDto } from './dto/sale.dto';
import { buildPaginationMeta } from 'src/common/dto/pagination.dto';
import { InventoryService } from '../inventory/inventory.service';
import { InventoryMovementType } from '../inventory/entities/inventory-history.entity';
import { ProductsService } from '../products/products.service';
import { ExpensesService } from '../expenses/expenses.service';
import { CustomersService } from '../customers/customers.service';
import { SalesService } from './sales.service';
import { ReferenceNumberService } from 'src/common/services/reference-number.service';

@Injectable()
export class SaleReturnService {
  constructor(
    @InjectRepository(SaleReturn)    private returnRepository: Repository<SaleReturn>,
    @InjectRepository(SaleReturnItem) private returnItemRepository: Repository<SaleReturnItem>,
    private readonly salesService: SalesService,
    private readonly customersService: CustomersService,
    private readonly inventoryService: InventoryService,
    private readonly productsService: ProductsService,
    private readonly expensesService: ExpensesService,
    private readonly referenceNumberService: ReferenceNumberService,
    private readonly storage: StorageService,
  ) {}

  async createReturn(dto: CreateSaleReturnDto, shopId: string, userId: string) {
    const sale = await this.salesService.findOne(dto.saleId, shopId);
    if (sale.status === SaleStatus.CANCELLED) {
      throw new BadRequestException('Cannot return a cancelled sale');
    }

    // Validate return quantities don't exceed what was originally sold
    const soldQtyByVariant: Record<string, number> = {};
    for (const item of sale.items) {
      if (item.variantId) {
        soldQtyByVariant[item.variantId] = (soldQtyByVariant[item.variantId] ?? 0) + Number(item.quantity);
      }
    }

    const existingReturns = await this.returnItemRepository
      .createQueryBuilder('ri')
      .innerJoin('ri.saleReturn', 'sr')
      .where('sr.saleId = :saleId', { saleId: dto.saleId })
      .select('ri.variantId', 'variantId')
      .addSelect('SUM(ri.quantity)', 'returned')
      .groupBy('ri.variantId')
      .getRawMany();

    const alreadyReturnedByVariant: Record<string, number> = {};
    for (const row of existingReturns) {
      alreadyReturnedByVariant[row.variantId] = Number(row.returned);
    }

    for (const item of dto.items) {
      if (!item.variantId) throw new BadRequestException('Each return item must include a variantId');
      const sold = soldQtyByVariant[item.variantId];
      if (sold === undefined) {
        throw new BadRequestException(`Variant ${item.variantId} was not part of the original sale`);
      }
      const alreadyReturned = alreadyReturnedByVariant[item.variantId] ?? 0;
      const remaining = sold - alreadyReturned;
      if (item.quantity > remaining) {
        throw new BadRequestException(
          `Cannot return ${item.quantity} units for variant ${item.variantId}. ` +
          `Originally sold: ${sold}, already returned: ${alreadyReturned}, remaining: ${remaining}.`,
        );
      }
    }

    const totalAmount = dto.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

    // For credit sales: first reduce outstanding debt, only pay cash for remainder
    let amountPaidToCustomer: number;
    let creditReduction = 0;

    if (sale.customerId && Number(sale.creditAmount) > 0) {
      const outstandingBalance = await this.customersService.getBalance(sale.customerId, shopId);
      creditReduction = Math.min(totalAmount, outstandingBalance);
      amountPaidToCustomer = totalAmount - creditReduction;
    } else {
      amountPaidToCustomer = dto.amountPaidToCustomer ?? totalAmount;
      if (amountPaidToCustomer > totalAmount) {
        throw new BadRequestException('Amount paid to customer cannot exceed total return amount');
      }
    }

    const amountToAccount = totalAmount - amountPaidToCustomer - creditReduction;

    const refNum = await this.referenceNumberService.generate('SRN', shopId, {
      table: 'sale_returns',
      padWidth: 4,
    });

    const savedReturn = await this.returnRepository.save(
      this.returnRepository.create({
        referenceNumber: refNum,
        saleId: dto.saleId,
        customerId: sale.customerId,
        status: SaleReturnStatus.COMPLETED,
        totalAmount,
        amountPaidToCustomer,
        amountToAccount: amountToAccount > 0 ? amountToAccount : 0,
        reason: dto.reason,
        notes: dto.notes,
        createdBy: userId,
        shopId,
      }),
    );

    const saleItemByVariant = Object.fromEntries(
      sale.items.map((i) => [i.variantId, { costPrice: Number(i.costPrice), productId: i.productId }]),
    );

    await this.returnItemRepository.save(
      dto.items.map((item) => {
        const original = saleItemByVariant[item.variantId];
        return this.returnItemRepository.create({
          saleReturnId: savedReturn.id,
          productId: original?.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.quantity * item.unitPrice,
          reason: item.reason,
          shopId,
        });
      }),
    );

    for (const item of dto.items) {
      const original = saleItemByVariant[item.variantId];
      await this.inventoryService.adjustStock(
        { productId: original?.productId, variantId: item.variantId, quantity: item.quantity, movementType: InventoryMovementType.RETURN_IN, unitCost: original?.costPrice ?? 0, referenceId: savedReturn.referenceNumber, referenceType: 'sale_return', performedBy: userId },
        shopId,
      );
    }

    // Reduce customer outstanding debt first (credit sale return)
    if (creditReduction > 0 && sale.customerId) {
      await this.customersService.recordCredit(sale.customerId, shopId, creditReduction, {
        type: CustomerLedgerType.SALE_RETURN_CREDIT,
        referenceType: 'sale_return',
        referenceId: savedReturn.id,
        description: `Return debt reduction: ${refNum}`,
        createdBy: userId,
      });
    }

    // Pay remaining amount to customer in cash
    if (amountPaidToCustomer > 0) {
      await this.expensesService.recordSystemExpense(
        { typeName: 'Sale Return', title: `Sale Return: ${refNum}`, amount: amountPaidToCustomer, referenceId: savedReturn.id, referenceType: 'sale_return' },
        shopId, userId,
      );
    }

    if (amountToAccount > 0 && sale.customerId) {
      await this.customersService.recordCredit(sale.customerId, shopId, amountToAccount, {
        type: CustomerLedgerType.SALE_RETURN_CREDIT,
        referenceType: 'sale_return',
        referenceId: savedReturn.id,
        description: `Return credit: ${refNum}`,
        createdBy: userId,
      });
    }

    return savedReturn;
  }

  async getReturns(shopId: string, page = 1, limit = 20) {
    const [data, total] = await this.returnRepository.findAndCount({
      where: { shopId },
      relations: ['customer', 'sale', 'items'],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return { data, message: 'Sale returns fetched successfully', meta: buildPaginationMeta(total, page, limit) };
  }

  async findOne(id: string, shopId: string) {
    const ret = await this.returnRepository.findOne({
      where: { id, shopId },
      relations: ['customer', 'sale', 'items', 'items.product', 'items.product.brand', 'items.product.category', 'items.product.unit', 'items.variant'],
    });
    if (!ret) throw new NotFoundException('Sale return not found');

    return {
      ...ret,
      items: ret.items.map((item) => ({
        id: item.id,
        createdAt: item.createdAt,
        shopId: item.shopId,
        saleReturnId: item.saleReturnId,
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
        reason: item.reason,
        product: item.product ? {
          name: item.product.name,
          description: item.product.description,
          image: this.storage.resolveUrl(item.product.image),
          type: item.product.type,
          brand: item.product.brand?.name ?? null,
          category: item.product.category?.name ?? null,
          unit: item.product.unit?.symbol ?? null,
        } : null,
        variant: item.variant ? {
          name: item.variant.name,
          sku: item.variant.sku,
          barcode: item.variant.barcode,
          attributes: item.variant.attributes,
        } : null,
      })),
    };
  }
}
