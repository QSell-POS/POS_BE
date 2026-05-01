import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { TenantBaseEntity } from 'src/common/entities/base.entity';
import { Product } from 'src/modules/products/entities/product.entity';

@Entity('inventory_batches')
@Index(['shopId', 'productId', 'createdAt'])
export class InventoryBatch extends TenantBaseEntity {
  @Column({ name: 'product_id' })
  productId: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'purchase_price' })
  purchasePrice: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'quantity_received' })
  quantityReceived: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'quantity_remaining' })
  quantityRemaining: number;

  @Column({ nullable: true, name: 'reference_id' })
  referenceId: string;

  @Column({ nullable: true, name: 'reference_type', length: 50 })
  referenceType: string;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;
}
