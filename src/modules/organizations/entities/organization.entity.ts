import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';
import { ShopPlan } from 'src/common/plans/plan.config';
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

  @Column({ type: 'enum', enum: ShopPlan, default: ShopPlan.FREE })
  plan: ShopPlan;

  @Column({ name: 'plan_expires_at', nullable: true })
  planExpiresAt: Date;

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
