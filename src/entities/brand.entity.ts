import { Product } from "./product.entity";
import { Shop } from "./shop.entity";
import {
  Column,
  Entity,
  Unique,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryGeneratedColumn,
  OneToMany,
} from "typeorm";

@Entity("brands")
@Unique(["name", "shopId"])
export class Brand {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @Column()
  shopId: string;

  @ManyToOne(() => Shop, (shop) => shop.brands, { onDelete: "CASCADE" })
  @JoinColumn({ name: "shopId" })
  shop: Shop;

  @OneToMany(() => Product, (product) => product.brand)
  products: Product[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
