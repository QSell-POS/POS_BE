import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { TenantBaseEntity } from 'src/common/entities/base.entity';
import { Product } from './product.entity';

export enum ProductStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DISCONTINUED = 'discontinued',
}

@Entity('product_variants')
@Index(['shopId', 'productId'])
@Index(['shopId', 'sku'], { unique: true, where: '"sku" IS NOT NULL AND "deleted_at" IS NULL' })
@Index(['shopId', 'barcode'], { unique: true, where: '"barcode" IS NOT NULL AND "deleted_at" IS NULL' })
export class ProductVariant extends TenantBaseEntity {
  @Column({ name: 'product_id' })
  productId: string;

  @Column({ length: 150 })
  name: string;

  @Column({ nullable: true, length: 100 })
  sku: string;

  @Column({ nullable: true, length: 100 })
  barcode: string;

  @Column({ nullable: true, length: 255 })
  image: string;

  @Column({ type: 'enum', enum: ProductStatus, default: ProductStatus.ACTIVE })
  status: ProductStatus;

  @Column({
    name: 'min_stock_level',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  minStockLevel: number;

  @Column({
    name: 'max_stock_level',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  maxStockLevel: number;

  @Column({
    name: 'reorder_point',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  reorderPoint: number;

  @Column({ default: true, name: 'track_inventory' })
  trackInventory: boolean;

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
