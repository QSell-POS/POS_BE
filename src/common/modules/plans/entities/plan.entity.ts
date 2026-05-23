import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';

export interface PlanLimits {
  maxShops: number;
  maxUsers: number;
  maxProducts: number;
  maxTransactionsPerMonth: number;
}

export interface PlanFeatureFlags {
  reports: boolean;
  bulkImport: boolean;
  loyalty: boolean;
  stockTransfer: boolean;
  apiAccess: boolean;
  invoiceGen: boolean;
}

@Entity('plans')
export class Plan extends BaseEntity {
  @Column({ length: 100 })
  name: string;

  @Index({ unique: true })
  @Column({ length: 50 })
  key: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'monthly_price' })
  monthlyPrice: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true, name: 'annual_price' })
  annualPrice: number | null;

  @Column({ type: 'int', default: 0, name: 'trial_days' })
  trialDays: number;

  @Column({ default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ default: false, name: 'is_popular' })
  isPopular: boolean;

  @Column({ type: 'int', default: 0, name: 'sort_order' })
  sortOrder: number;

  // -1 on any limit means unlimited
  @Column({ type: 'jsonb', default: () => `'{}'` })
  limits: PlanLimits;

  // Display strings for the pricing UI (e.g. "5 shops", "Priority support")
  @Column({ type: 'jsonb', default: () => `'[]'` })
  features: string[];

  // Typed flags consumed by PlanGuard / PlanService for enforcement
  @Column({ type: 'jsonb', default: () => `'{}'`, name: 'feature_flags' })
  featureFlags: PlanFeatureFlags;
}
