import { Entity, Column, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum CatalogProductStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('catalog_products')
export class CatalogProduct extends BaseEntity {
  @ApiProperty()
  @Column({ length: 150 })
  name: string;

  @ApiPropertyOptional()
  @Column({ nullable: true, type: 'text' })
  description: string;

  @ApiPropertyOptional()
  @Column({ nullable: true, type: 'text' })
  image: string;

  @ApiPropertyOptional()
  @Column({ nullable: true, length: 100 })
  barcode: string;

  @ApiPropertyOptional()
  @Column({ name: 'category_id', nullable: true })
  categoryId: string;

  @ApiPropertyOptional()
  @Column({ name: 'brand_id', nullable: true })
  brandId: string;

  @ApiPropertyOptional()
  @Column({ name: 'unit_id', nullable: true })
  unitId: string;

  @ApiPropertyOptional()
  @Column({ name: 'shop_type', nullable: true, length: 100 })
  shopType: string;

  @ApiProperty({ enum: CatalogProductStatus })
  @Column({ type: 'enum', enum: CatalogProductStatus, default: CatalogProductStatus.PENDING })
  status: CatalogProductStatus;

  @ApiPropertyOptional()
  @Column({ name: 'suggested_by', nullable: true })
  suggestedBy: string;

  @ApiPropertyOptional()
  @Column({ name: 'approved_by', nullable: true })
  approvedBy: string;

  @ApiPropertyOptional()
  @Column({ name: 'rejection_reason', nullable: true, type: 'text' })
  rejectionReason: string;

  @OneToMany(() => CatalogVariant, (v) => v.catalogProduct)
  variants: CatalogVariant[];
}

@Entity('catalog_variants')
export class CatalogVariant extends BaseEntity {
  @ApiProperty()
  @Column({ name: 'catalog_product_id' })
  catalogProductId: string;

  @ApiProperty()
  @Column({ length: 150 })
  name: string;

  @ApiPropertyOptional()
  @Column({ nullable: true, length: 100 })
  barcode: string;

  @ApiPropertyOptional()
  @Column({ nullable: true, type: 'jsonb' })
  attributes: Record<string, any>;

  @ManyToOne(() => CatalogProduct, (p) => p.variants)
  @JoinColumn({ name: 'catalog_product_id' })
  catalogProduct: CatalogProduct;
}
