import { Entity, Column, OneToMany } from 'typeorm';
import { TenantBaseEntity } from 'src/common/entities/base.entity';
import { Product } from 'src/modules/products/entities/product.entity';

@Entity('units')
export class Unit extends TenantBaseEntity {
  @Column({ length: 50 })
  name: string;

  @Column({ length: 20 })
  symbol: string;

  @Column({ type: 'float', default: 1 })
  baseMultiplier: number;

  @Column({ nullable: true, length: 500 })
  description: string;

  @Column({ default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ default: false, name: 'is_global' })
  isGlobal: boolean;

  @OneToMany(() => Product, (product) => product.unit)
  products: Product[];
}
