import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { StorageService } from 'src/common/services/storage.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PurchaseReturn, PurchaseReturnItem, PurchaseReturnStatus } from './entities/purchase-return.entity';
import { SupplierLedgerType } from './entities/supplier-ledger.entity';
import { CreatePurchaseReturnDto, PurchaseReturnFilterDto } from './dto/purchase.dto';
import { buildPaginationMeta } from 'src/common/dto/pagination.dto';
import { InventoryService } from '../inventory/inventory.service';
import { InventoryMovementType } from '../inventory/entities/inventory-history.entity';
import { ProductsService } from '../products/products.service';
import { ExpensesService } from '../expenses/expenses.service';
import { SuppliersService } from '../suppliers/suppliers.service';
import { PurchasesService } from './purchases.service';
import { ReferenceNumberService } from 'src/common/services/reference-number.service';

@Injectable()
export class PurchaseReturnService {
  constructor(
    @InjectRepository(PurchaseReturn)     private returnRepository: Repository<PurchaseReturn>,
    @InjectRepository(PurchaseReturnItem) private returnItemRepository: Repository<PurchaseReturnItem>,
    private readonly purchasesService: PurchasesService,
    private readonly suppliersService: SuppliersService,
    private readonly inventoryService: InventoryService,
    private readonly productsService: ProductsService,
    private readonly expensesService: ExpensesService,
    private readonly referenceNumberService: ReferenceNumberService,
    private readonly storage: StorageService,
  ) {}

  async createReturn(dto: CreatePurchaseReturnDto, shopId: string, userId: string) {
    const purchase = await this.purchasesService.findOne(dto.purchaseId, shopId);

    // Validate return quantities don't exceed what was originally purchased
    const purchasedQtyByVariant: Record<string, number> = {};
    for (const item of purchase.items) {
      purchasedQtyByVariant[item.variantId] = (purchasedQtyByVariant[item.variantId] ?? 0) + Number(item.quantity);
    }

    const existingReturns = await this.returnItemRepository
      .createQueryBuilder('ri')
      .innerJoin('ri.purchaseReturn', 'pr')
      .where('pr.purchaseId = :purchaseId', { purchaseId: dto.purchaseId })
      .select('ri.variantId', 'variantId')
      .addSelect('SUM(ri.quantity)', 'returned')
      .groupBy('ri.variantId')
      .getRawMany();

    const alreadyReturnedByVariant: Record<string, number> = {};
    for (const row of existingReturns) {
      alreadyReturnedByVariant[row.variantId] = Number(row.returned);
    }

    // Fetch variant info (name + unit) for readable error messages
    const variantInfoMap: Record<string, { name: string; unit: string }> = {};
    for (const item of dto.items) {
      if (item.variantId && !variantInfoMap[item.variantId]) {
        const variant = await this.productsService.getVariantById(item.variantId, shopId);
        const product = await this.productsService.findOne(variant.productId, shopId);
        variantInfoMap[item.variantId] = {
          name: variant.name,
          unit: product.unit?.symbol ?? 'pcs',
        };
      }
    }

    for (const item of dto.items) {
      const purchased = purchasedQtyByVariant[item.variantId] ?? 0;
      const alreadyReturned = alreadyReturnedByVariant[item.variantId] ?? 0;
      const remaining = purchased - alreadyReturned;
      if (item.quantity > remaining) {
        const { name, unit } = variantInfoMap[item.variantId] ?? { name: item.variantId, unit: 'pcs' };
        throw new BadRequestException(
          `Cannot return ${item.quantity} ${unit} for product ${name}. ` +
          `Originally purchased: ${purchased} ${unit}, already returned: ${alreadyReturned} ${unit}, remaining: ${remaining} ${unit}.`,
        );
      }
    }

    const totalAmount = dto.items.reduce((s, i) => s + i.quantity * i.unitCost, 0);
    const amountReceivedFromSupplier = dto.amountReceivedFromSupplier ?? totalAmount;
    const amountToAccount = totalAmount - amountReceivedFromSupplier;

    if (amountReceivedFromSupplier > totalAmount) {
      throw new BadRequestException('Amount received cannot exceed total return amount');
    }

    const refNum = await this.referenceNumberService.generate('PRN', shopId, {
      table: 'purchase_returns',
      padWidth: 4,
    });

    const savedReturn = await this.returnRepository.save(
      this.returnRepository.create({
        referenceNumber: refNum,
        purchaseId: dto.purchaseId,
        supplierId: purchase.supplierId,
        status: PurchaseReturnStatus.COMPLETED,
        totalAmount,
        amountReceivedFromSupplier,
        amountToAccount,
        reason: dto.reason,
        notes: dto.notes,
        createdBy: userId,
        shopId,
      }),
    );

    const itemsWithProducts = await Promise.all(
      dto.items.map(async (item) => {
        const variant = await this.productsService.getVariantById(item.variantId, shopId);
        return { ...item, productId: variant.productId };
      }),
    );

    await this.returnItemRepository.save(
      itemsWithProducts.map((item) =>
        this.returnItemRepository.create({
          purchaseReturnId: savedReturn.id,
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          unitCost: item.unitCost,
          subtotal: item.quantity * item.unitCost,
          reason: item.reason,
          shopId,
        }),
      ),
    );

    for (const item of itemsWithProducts) {
      await this.inventoryService.adjustStock(
        { productId: item.productId, variantId: item.variantId, quantity: item.quantity, movementType: InventoryMovementType.RETURN_OUT, unitCost: item.unitCost, referenceId: savedReturn.referenceNumber, referenceType: 'purchase_return', performedBy: userId },
        shopId,
      );
    }

    if (amountReceivedFromSupplier > 0 && purchase.supplierId) {
      await this.suppliersService.recordCredit(purchase.supplierId, shopId, amountReceivedFromSupplier, {
        type: SupplierLedgerType.PURCHASE_RETURN_CREDIT,
        referenceType: 'purchase_return',
        referenceId: savedReturn.id,
        description: `Return cash received: ${refNum}`,
        createdBy: userId,
      });
      await this.expensesService.recordSystemExpense(
        { typeName: 'Purchase Return', title: `Purchase Return: ${refNum}`, amount: amountReceivedFromSupplier, referenceId: savedReturn.id, referenceType: 'purchase_return', isIncome: true },
        shopId, userId,
      );
    }

    if (amountToAccount > 0 && purchase.supplierId) {
      await this.suppliersService.recordCredit(purchase.supplierId, shopId, amountToAccount, {
        type: SupplierLedgerType.PURCHASE_RETURN_CREDIT,
        referenceType: 'purchase_return',
        referenceId: savedReturn.id,
        description: `Return credit: ${refNum}`,
        createdBy: userId,
      });
    }

    return savedReturn;
  }

  async getReturns(shopId: string, filters: PurchaseReturnFilterDto) {
    const { page = 1, limit = 20 } = filters;
    const [data, total] = await this.returnRepository.findAndCount({
      where: { shopId },
      relations: ['supplier', 'purchase'],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return { data, message: 'Purchase returns fetched successfully', meta: buildPaginationMeta(total, page, limit) };
  }

  async findOne(id: string, shopId: string) {
    const ret = await this.returnRepository.findOne({
      where: { id, shopId },
      relations: ['supplier', 'purchase', 'items', 'items.product', 'items.product.brand', 'items.product.category', 'items.product.unit', 'items.variant'],
    });
    if (!ret) throw new NotFoundException('Purchase return not found');

    return {
      ...ret,
      items: ret.items.map((item) => ({
        id: item.id,
        createdAt: item.createdAt,
        shopId: item.shopId,
        purchaseReturnId: item.purchaseReturnId,
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        unitCost: item.unitCost,
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
