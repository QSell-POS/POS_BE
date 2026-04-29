import { Entity, Column } from 'typeorm';
import { TenantBaseEntity } from 'src/common/entities/base.entity';

export enum DiscountType {
  PERCENTAGE = 'percentage',
  FIXED = 'fixed',
}

export enum DiscountApplyTo {
  CART = 'cart',
  PRODUCT = 'product',
  CATEGORY = 'category',
}

@Entity('discounts')
export class Discount extends TenantBaseEntity {
  @Column({ length: 100 })
  name: string;

  @Column({ unique: true, length: 50 })
  code: string;

  @Column({ type: 'enum', enum: DiscountType })
  type: DiscountType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  value: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'min_order_amount' })
  minOrderAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'max_discount_amount' })
  maxDiscountAmount: number;

  @Column({ type: 'enum', enum: DiscountApplyTo, default: DiscountApplyTo.CART })
  applyTo: DiscountApplyTo;

  @Column({ nullable: true, name: 'apply_to_id' })
  applyToId: string;

  @Column({ name: 'usage_limit', nullable: true })
  usageLimit: number;

  @Column({ name: 'usage_count', default: 0 })
  usageCount: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'starts_at', nullable: true, type: 'timestamptz' })
  startsAt: Date;

  @Column({ name: 'expires_at', nullable: true, type: 'timestamptz' })
  expiresAt: Date;
}
