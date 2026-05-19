import { Entity, Column, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';
import { Unit } from 'src/modules/units/entities/unit.entity';
import { Brand } from 'src/modules/brands/entities/brand.entity';
import { TenantBaseEntity } from 'src/common/entities/base.entity';
import { Category } from 'src/modules/categories/entities/category.entity';
import { InventoryItem } from 'src/modules/inventory/entities/inventory-item.entity';
import { ProductPrice } from './product-price.entity';
import { ProductVariant } from './product-variant.entity';
import { SaleItem } from 'src/modules/sales/entities/sale.entity';

export enum ProductType {
  STANDARD = 'standard',
  SERVICE = 'service',
  DIGITAL = 'digital',
}

export enum ProductSource {
  MANUAL = 'manual',
  CATALOG = 'catalog',
  SUGGESTION = 'suggestion',
}

@Entity('products')
@Index(['shopId', 'categoryId'])
@Index(['shopId', 'brandId'])
export class Product extends TenantBaseEntity {
  @Column({ length: 150 })
  name: string;

  @Column({ nullable: true, type: 'text' })
  description: string;

  @Column({ nullable: true, type: 'text' })
  image: string;

  @Column({ type: 'enum', enum: ProductType, default: ProductType.STANDARD })
  type: ProductType;

  @Column({ name: 'brand_id', nullable: true })
  brandId: string;

  @Column({ name: 'category_id', nullable: true })
  categoryId: string;

  @Column({ name: 'unit_id', nullable: true })
  unitId: string;

  @Column({ name: 'has_variants', default: false })
  hasVariants: boolean;

  @Column({ name: 'catalog_product_id', nullable: true })
  catalogProductId: string;

  @Column({ type: 'enum', enum: ProductSource, default: ProductSource.MANUAL })
  source: ProductSource;

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
