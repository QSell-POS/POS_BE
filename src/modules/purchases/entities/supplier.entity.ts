import { Entity, Column, OneToMany } from "typeorm";
import { TenantBaseEntity } from "src/common/entities/base.entity";

@Entity("suppliers")
export class Supplier extends TenantBaseEntity {
  @Column({ length: 150 })
  name: string;

  @Column({ nullable: true, length: 100 })
  contactPerson: string;

  @Column({ nullable: true, length: 20 })
  phone: string;

  @Column({ nullable: true, length: 100 })
  email: string;

  @Column({ nullable: true, type: "text" })
  address: string;

  @Column({ nullable: true, length: 100 })
  taxNumber: string;

  @Column({
    type: "decimal",
    precision: 12,
    scale: 2,
    default: 0,
    name: "total_purchased",
  })
  totalPurchased: number;

  @Column({
    type: "decimal",
    precision: 12,
    scale: 2,
    default: 0,
    name: "total_due",
  })
  totalDue: number;

  @Column({ type: "decimal", precision: 12, scale: 2, default: 0, name: "credit_balance" })
  creditBalance: number;

  @Column({ default: true, name: "is_active" })
  isActive: boolean;

  @Column({ nullable: true, type: "text" })
  notes: string;
}
