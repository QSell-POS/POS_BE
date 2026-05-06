import { Entity, Column } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';
import { ShopPlan } from 'src/common/plans/plan.config';

export enum ShopStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

@Entity('shops')
export class Shop extends BaseEntity {
  @Column({ length: 100 })
  name: string;

  @Column({ unique: true, length: 50 })
  slug: string;

  @Column({ nullable: true, length: 500 })
  address: string;

  @Column({ nullable: true, length: 20 })
  phone: string;

  @Column({ nullable: true, length: 100 })
  email: string;

  @Column({ nullable: true, length: 255 })
  logo: string;

  @Column({ nullable: true, length: 50 })
  currency: string;

  @Column({ default: 'USD', length: 10 })
  currencySymbol: string;

  @Column({ type: 'enum', enum: ShopStatus, default: ShopStatus.ACTIVE })
  status: ShopStatus;

  @Column({ nullable: true, type: 'text' })
  settings: string;

  @Column({ name: 'owner_id', nullable: true })
  ownerId: string;

  @Column({ type: 'enum', enum: ShopPlan, default: ShopPlan.FREE })
  plan: ShopPlan;

  @Column({ name: 'plan_expires_at', nullable: true })
  planExpiresAt: Date;
}
