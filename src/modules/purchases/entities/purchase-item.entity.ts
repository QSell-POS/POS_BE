import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { TenantBaseEntity } from 'src/common/entities/base.entity';
import { Purchase } from './purchase.entity';
import { Product } from 'src/modules/products/entities/product.entity';
import { ProductVariant } from 'src/modules/products/entities/product-variant.entity';

@Entity('purchase_items')
export class PurchaseItem extends TenantBaseEntity {
  @Column({ name: 'purchase_id' })
  purchaseId: string;

  @Column({ name: 'product_id' })
  productId: string;

  @Column({ name: 'variant_id' })
  variantId: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  quantity: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'received_quantity', default: 0 })
  receivedQuantity: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'unit_cost' })
  unitCost: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0, name: 'tax_rate' })
  taxRate: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'tax_amount' })
  taxAmount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0, name: 'discount_rate' })
  discountRate: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'discount_amount' })
  discountAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'subtotal' })
  subtotal: number;

  @Column({ nullable: true, type: 'text' })
  notes: string;

  @ManyToOne(() => Purchase, (purchase) => purchase.items)
  @JoinColumn({ name: 'purchase_id' })
  purchase: Purchase;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @ManyToOne(() => ProductVariant)
  @JoinColumn({ name: 'variant_id' })
  variant: ProductVariant;
}
