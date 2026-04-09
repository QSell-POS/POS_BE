import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class Product {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  shopId: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ unique: true })
  sku: string;

  @Column({ nullable: true })
  barcode: string;

  @Column({ default: "pcs" })
  unit: string;

  @Column("decimal", { precision: 10, scale: 2 })
  sellingPrice: number;

  @Column("decimal", { precision: 10, scale: 2 })
  costPrice: number;

  @Column({ default: 0 })
  lowStockAlert: number;

  @Column({ default: true })
  isActive: boolean;
}
