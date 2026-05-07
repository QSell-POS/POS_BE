import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';
import { ShopPlan } from 'src/common/plans/plan.config';

export enum SubscriptionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum SubscriptionDuration {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

@Entity('subscriptions')
export class Subscription extends BaseEntity {
  @Index()
  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ type: 'enum', enum: ShopPlan })
  plan: ShopPlan;

  @Column({ type: 'enum', enum: SubscriptionDuration })
  duration: SubscriptionDuration;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'enum', enum: SubscriptionStatus, default: SubscriptionStatus.PENDING })
  status: SubscriptionStatus;

  @Index()
  @Column({ name: 'transaction_uuid', unique: true })
  transactionUuid: string;

  @Column({ name: 'esewa_transaction_code', nullable: true })
  esewaTransactionCode: string;

  @Column({ name: 'plan_starts_at', nullable: true })
  planStartsAt: Date;

  @Column({ name: 'plan_expires_at', nullable: true })
  planExpiresAt: Date;
}
