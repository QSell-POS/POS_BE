import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NOTIFICATION_QUEUE } from './notification.jobs';
import { NotificationService } from './notification.service';
import { NotificationProcessor } from './notification.processor';
import { NotificationScheduler } from './notification.scheduler';
import { InventoryItem } from 'src/modules/inventory/entities/inventory-item.entity';
import { ProductVariant } from 'src/modules/products/entities/product-variant.entity';
import { Shift } from 'src/modules/shifts/entities/shift.entity';
import { Customer } from 'src/modules/sales/entities/customer.entity';
import { User } from 'src/modules/users/entities/user.entity';
import { Shop } from 'src/modules/shops/entities/shop.entity';

@Module({
  imports: [
    BullModule.registerQueue({ name: NOTIFICATION_QUEUE }),
    TypeOrmModule.forFeature([InventoryItem, ProductVariant, Shift, Customer, User, Shop]),
  ],
  providers: [NotificationService, NotificationProcessor, NotificationScheduler],
  exports: [NotificationService],
})
export class NotificationsModule {}
