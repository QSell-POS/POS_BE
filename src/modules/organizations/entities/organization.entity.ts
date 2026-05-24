import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';
import { ShopPlan } from 'src/common/modules/plans/plan.config';
import { Shop } from 'src/modules/shops/entities/shop.entity';

export enum OrgStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
}

@Entity('organizations')
export class Organization extends BaseEntity {
  @Column({ length: 100 })
  name: string;

  @Column({ name: 'owner_id' })
  ownerId: string;

  @Column({ type: 'enum', enum: OrgStatus, default: OrgStatus.ACTIVE })
  status: OrgStatus;

  // Plan key referencing plans.key. Free-form string so super admins can
  // assign any plan created via the /plans API (not limited to the ShopPlan enum).
  @Column({ default: ShopPlan.FREE, length: 50 })
  plan: string;

  @Column({ name: 'plan_expires_at', nullable: true })
  planExpiresAt: Date;

  @Column({ name: 'trial_ends_at', nullable: true })
  trialEndsAt: Date;

  @Column({ nullable: true, length: 255 })
  logo: string;

  @Column({ nullable: true, length: 500 })
  address: string;

  @Column({ nullable: true, length: 100 })
  email: string;

  @Column({ nullable: true, length: 20 })
  phone: string;

  @OneToMany(() => Shop, (shop) => shop.organization)
  shops: Shop[];
}
