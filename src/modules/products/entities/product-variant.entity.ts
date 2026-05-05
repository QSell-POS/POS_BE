import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { TenantBaseEntity } from 'src/common/entities/base.entity';
import { Product } from './product.entity';

@Entity('product_variants')
@Index(['shopId', 'productId'])
@Index(['shopId', 'sku'], { unique: true, where: '"sku" IS NOT NULL AND "deleted_at" IS NULL' })
export class ProductVariant extends TenantBaseEntity {
  @Column({ name: 'product_id' })
  productId: string;

  @Column({ length: 150 })
  name: string;

  @Column({ nullable: true, length: 100 })
  sku: string;

  @Column({ nullable: true, length: 100 })
  barcode: string;

  // e.g. { "color": "Red", "size": "M" }
  @Column({ type: 'jsonb', nullable: true })
  attributes: Record<string, string>;

  @Column({ name: 'is_default', default: false })
  isDefault: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @ManyToOne(() => Product, (product) => product.variants)
  @JoinColumn({ name: 'product_id' })
  product: Product;
}
