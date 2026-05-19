import { Entity, Column, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

@Entity('shop_products')
export class ShopProduct {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'shop_id' })
  shopId: string;

  @Column({ name: 'catalog_product_id' })
  catalogProductId: string;

  @Column({ name: 'product_id', nullable: true })
  productId: string;

  @CreateDateColumn({ name: 'added_at' })
  addedAt: Date;
}
