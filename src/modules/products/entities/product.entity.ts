import { Entity, Column, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';
import { Unit } from 'src/modules/units/entities/unit.entity';
import { Brand } from 'src/modules/brands/entities/brand.entity';
import { TenantBaseEntity } from 'src/common/entities/base.entity';
import { Category } from 'src/modules/categories/entities/category.entity';
import { InventoryItem } from 'src/modules/inventory/entities/inventory-item.entity';
import { ProductPrice } from './product-price.entity';
import { ProductVariant } from './product-variant.entity';
import { SaleItem } from 'src/modules/sales/entities/sale.entity';

export enum ProductStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DISCONTINUED = 'discontinued',
}

export enum ProductType {
  STANDARD = 'standard',
  SERVICE = 'service',
  DIGITAL = 'digital',
}

@Entity('products')
@Index(['shopId', 'status'])
@Index(['shopId', 'categoryId'])
@Index(['shopId', 'brandId'])
@Index(['barcode'])
@Index(['sku'])
export class Product extends TenantBaseEntity {
  @Column({ length: 150 })
  name: string;

  @Column({ unique: false, length: 100, nullable: true })
  sku: string;

  @Column({ nullable: true, length: 100, name: 'barcode' })
  barcode: string;

  @Column({ nullable: true, type: 'text' })
  description: string;

  @Column({ nullable: true, length: 255 })
  image: string;

  @Column({ type: 'enum', enum: ProductStatus, default: ProductStatus.ACTIVE })
  status: ProductStatus;

  @Column({ type: 'enum', enum: ProductType, default: ProductType.STANDARD })
  type: ProductType;

  @Column({ name: 'brand_id', nullable: true })
  brandId: string;

  @Column({ name: 'category_id', nullable: true })
  categoryId: string;

  @Column({ name: 'unit_id', nullable: true })
  unitId: string;

  @Column({
    name: 'tax_rate',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
  })
  taxRate: number;

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

  @Column({ name: 'has_variants', default: false })
  hasVariants: boolean;

  // Relations
  @ManyToOne(() => Brand, (brand) => brand.products, { nullable: true })
  @JoinColumn({ name: 'brand_id' })
  brand: Brand;

  @ManyToOne(() => Category, (category) => category.products, {
    nullable: true,
  })
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @ManyToOne(() => Unit, (unit) => unit.products, { nullable: true })
  @JoinColumn({ name: 'unit_id' })
  unit: Unit;

  @OneToMany(() => ProductPrice, (price) => price.product)
  prices: ProductPrice[];

  @OneToMany(() => InventoryItem, (inventory) => inventory.product)
  inventoryItems: InventoryItem[];

  @OneToMany(() => ProductVariant, (variant) => variant.product)
  variants: ProductVariant[];

  @OneToMany(() => SaleItem, (saleItem) => saleItem.product)
  saleItems: SaleItem[];
}
