import { Column, Entity, PrimaryGeneratedColumn, OneToMany } from "typeorm";
import { Product } from "./product.entity";
import { Purchase } from "./purchase.entity";
import { Brand } from "./brand.entity";
import { Category } from "./category.entity";

@Entity("shops")
export class Shop {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  ownerId: string;

  @Column({ default: "" })
  name: string;

  @OneToMany(() => Product, (product) => product.shop)
  products: Product[];

  @OneToMany(() => Purchase, (purchase) => purchase.shop)
  purchases: Purchase[];

  @OneToMany(() => Brand, (brand) => brand.shop)
  brands: Brand[];

  @OneToMany(() => Category, (category) => category.shop)
  categories: Category[];
}
