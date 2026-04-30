import { Entity, Column } from 'typeorm';
import { TenantBaseEntity } from 'src/common/entities/base.entity';

export enum CustomerType {
  VIP = 'vip',
  RETAIL = 'retail',
  WHOLESALE = 'wholesale',
}

@Entity('customers')
export class Customer extends TenantBaseEntity {
  @Column({ length: 150 })
  name: string;

  @Column({ nullable: true, length: 20 })
  phone: string;

  @Column({ nullable: true, length: 100 })
  email: string;

  @Column({ nullable: true, type: 'text' })
  address: string;

  @Column({ type: 'enum', enum: CustomerType, default: CustomerType.RETAIL, name: 'customer_type' })
  customerType: CustomerType;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0, name: 'discount_rate' })
  discountRate: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'total_purchased' })
  totalPurchased: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'total_due' })
  totalDue: number;

  @Column({ default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ nullable: true, type: 'text' })
  notes: string;
}
