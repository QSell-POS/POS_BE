import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
} from "typeorm";

@Entity()
@Unique(["branchId", "productId"]) // 🚨 one product per branch
@Index(["branchId", "productId"]) // ⚡ fast queries
export class Inventory {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  branchId: string;

  @Column()
  productId: string;

  @Column({ type: "int", default: 0 })
  quantity: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
