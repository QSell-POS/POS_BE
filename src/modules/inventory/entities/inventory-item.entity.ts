import { Entity, Column, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';

import { TenantBaseEntity } from 'src/common/entities/base.entity';
import { Product } from '../../products/entities/product.entity';
import { InventoryHistory } from './inventory-history.entity';

@Entity('inventory_items')
@Index(['shopId', 'productId'], { unique: true })
@Index(['shopId', 'quantityAvailable'])
export class InventoryItem extends TenantBaseEntity {
  @Column({ name: 'product_id' })
  productId: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'quantity_on_hand' })
  quantityOnHand: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'quantity_reserved' })
  quantityReserved: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'quantity_available' })
  quantityAvailable: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'average_cost' })
  averageCost: number;

  @Column({ name: 'last_restocked_at', nullable: true, type: 'timestamp' })
  lastRestockedAt: Date;

  @Column({ name: 'last_sold_at', nullable: true, type: 'timestamp' })
  lastSoldAt: Date;

  @Column({ name: 'location', nullable: true, length: 100 })
  location: string; // Shelf/rack location in store

  @ManyToOne(() => Product, (product) => product.inventoryItems)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @OneToMany(() => InventoryHistory, (history) => history.inventoryItem)
  history: InventoryHistory[];
}
