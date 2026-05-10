import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { NotificationService } from './notification.service';
import { InventoryItem } from 'src/modules/inventory/entities/inventory-item.entity';
import { ProductVariant } from 'src/modules/products/entities/product-variant.entity';
import { Shift } from 'src/modules/shifts/entities/shift.entity';
import { Customer } from 'src/modules/sales/entities/customer.entity';
import { User, UserRole } from 'src/modules/users/entities/user.entity';
import { Shop } from 'src/modules/shops/entities/shop.entity';

@Injectable()
export class NotificationScheduler {
  private readonly logger = new Logger(NotificationScheduler.name);

  constructor(
    private readonly notifications: NotificationService,
    @InjectRepository(InventoryItem)  private readonly inventoryRepo: Repository<InventoryItem>,
    @InjectRepository(ProductVariant) private readonly variantRepo:   Repository<ProductVariant>,
    @InjectRepository(Shift)          private readonly shiftRepo:     Repository<Shift>,
    @InjectRepository(Customer)       private readonly customerRepo:  Repository<Customer>,
    @InjectRepository(User)           private readonly userRepo:      Repository<User>,
    @InjectRepository(Shop)           private readonly shopRepo:      Repository<Shop>,
  ) {}

  // ── Low stock check — every day at 8 AM ──────────────────────────────────

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async checkLowStock() {
    this.logger.log('Running low stock check...');

    const items = await this.inventoryRepo
      .createQueryBuilder('inv')
      .innerJoin(ProductVariant, 'v', 'v.id = inv.variantId AND v.deletedAt IS NULL AND v.minStockLevel > 0')
      .where('inv.quantityAvailable <= v.minStockLevel')
      .select([
        'inv.shopId        AS "shopId"',
        'inv.quantityAvailable AS "current"',
        'v.minStockLevel   AS "minimum"',
        'v.sku             AS "sku"',
        'inv.productId     AS "productId"',
        'inv.variantId     AS "variantId"',
      ])
      .getRawMany();

    for (const item of items) {
      const adminEmail = await this.getAdminEmail(item.shopId);
      if (!adminEmail) continue;

      const variant = await this.variantRepo.findOne({
        where: { id: item.variantId },
        relations: ['product'],
      });

      await this.notifications.notifyLowStock({
        shopId:      item.shopId,
        productName: variant?.product?.name ?? 'Unknown',
        variantSku:  item.sku,
        current:     Number(item.current),
        minimum:     Number(item.minimum),
        adminEmail,
      });
    }

    this.logger.log(`Low stock check done — ${items.length} alert(s) queued`);
  }

  // ── Shift reminder — every day at 10 PM ──────────────────────────────────

  @Cron(CronExpression.EVERY_DAY_AT_10PM)
  async checkOpenShifts() {
    this.logger.log('Checking for open shifts...');

    // Find shifts open for more than 14 hours
    const threshold = new Date(Date.now() - 14 * 60 * 60 * 1000);
    const openShifts = await this.shiftRepo.find({
      where: { status: 'open' as any, openedAt: LessThan(threshold) },
      relations: ['openedByUser'],
    });

    for (const shift of openShifts) {
      const adminEmail = await this.getAdminEmail(shift.shopId);
      if (!adminEmail) continue;

      await this.notifications.notifyShiftReminder({
        shopId:    shift.shopId,
        shiftId:   shift.id,
        openedBy:  `${shift.openedByUser?.firstName ?? ''} ${shift.openedByUser?.lastName ?? ''}`.trim(),
        openedAt:  shift.openedAt?.toISOString() ?? '',
        adminEmail,
      });
    }

    this.logger.log(`Shift check done — ${openShifts.length} reminder(s) queued`);
  }

  // ── Payment due reminders — every day at 9 AM ────────────────────────────

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async checkPaymentDues() {
    this.logger.log('Checking payment dues...');

    const customers = await this.customerRepo
      .createQueryBuilder('c')
      .where('c.totalDue > 0')
      .andWhere('c.isActive = true')
      .getMany();

    // Group by shop to send one batch per shop admin
    const byShop = new Map<string, typeof customers>();
    for (const c of customers) {
      if (!byShop.has(c.shopId)) byShop.set(c.shopId, []);
      byShop.get(c.shopId).push(c);
    }

    for (const [shopId, shopCustomers] of byShop) {
      const adminEmail = await this.getAdminEmail(shopId);
      if (!adminEmail) continue;

      for (const customer of shopCustomers) {
        await this.notifications.notifyPaymentDue({
          shopId,
          customerName:  customer.name,
          customerEmail: customer.email ?? null,
          amountDue:     Number(customer.totalDue),
          adminEmail,
        });
      }
    }

    this.logger.log(`Payment due check done — ${customers.length} reminder(s) queued`);
  }

  // ── Helper: get admin email for a shop ───────────────────────────────────

  private async getAdminEmail(shopId: string): Promise<string | null> {
    const shop = await this.shopRepo.findOne({ where: { id: shopId } });
    if (!shop) return null;

    const admin = await this.userRepo.findOne({
      where: { organizationId: shop.organizationId, role: UserRole.ADMIN },
      select: ['email'],
    });

    return admin?.email ?? null;
  }
}
