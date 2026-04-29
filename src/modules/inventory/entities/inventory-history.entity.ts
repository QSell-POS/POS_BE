import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';

import { InventoryItem } from './inventory-item.entity';
import { TenantBaseEntity } from 'src/common/entities/base.entity';
import { Product } from 'src/modules/products/entities/product.entity';
import { User } from 'src/modules/users/entities/user.entity';

export enum InventoryMovementType {
  PURCHASE = 'purchase',
  SALE = 'sale',
  RETURN_IN = 'return_in', // Return from customer
  RETURN_OUT = 'return_out', // Return to supplier
  ADJUSTMENT_IN = 'adjustment_in',
  ADJUSTMENT_OUT = 'adjustment_out',
  TRANSFER_IN = 'transfer_in',
  TRANSFER_OUT = 'transfer_out',
  OPENING_STOCK = 'opening_stock',
  DAMAGE = 'damage',
  EXPIRY = 'expiry',
}

@Entity('inventory_history')
export class InventoryHistory extends TenantBaseEntity {
  @Column({ name: 'inventory_item_id' })
  inventoryItemId: string;

  @Column({ name: 'product_id' })
  productId: string;

  @Column({ type: 'enum', enum: InventoryMovementType, name: 'movement_type' })
  movementType: InventoryMovementType;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  quantity: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'quantity_before' })
  quantityBefore: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'quantity_after' })
  quantityAfter: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true, name: 'unit_cost' })
  unitCost: number;

  @Column({ nullable: true, name: 'reference_id' })
  referenceId: string; // invoice/reference number (e.g. INV-..., PO-..., SRN-..., TRF-...)

  @Column({ nullable: true, name: 'reference_type', length: 50 })
  referenceType: string;

  @Column({ nullable: true, type: 'text' })
  notes: string;

  @Column({ name: 'performed_by', nullable: true })
  performedByUserId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'performed_by' })
  performedByUser: User;

  @ManyToOne(() => InventoryItem, (item) => item.history)
  @JoinColumn({ name: 'inventory_item_id' })
  inventoryItem: InventoryItem;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;
}
