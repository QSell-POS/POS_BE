import { Entity, Column, OneToMany } from "typeorm";
import { TenantBaseEntity } from "src/common/entities/base.entity";
import { Product } from "src/modules/products/entities/product.entity";

@Entity("brands")
export class Brand extends TenantBaseEntity {
  @Column({ length: 100 })
  name: string;

  @Column({ nullable: true, length: 500 })
  description: string;

  @Column({ nullable: true, length: 255 })
  logo: string;

  @Column({ nullable: true, length: 100 })
  website: string;

  @Column({ default: true, name: "is_active" })
  isActive: boolean;

  @Column({ default: false, name: "is_global" })
  isGlobal: boolean;

  @OneToMany(() => Product, (product) => product.brand)
  products: Product[];
}
