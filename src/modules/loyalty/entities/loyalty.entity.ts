import { Entity, Column } from 'typeorm';
import { TenantBaseEntity } from 'src/common/entities/base.entity';

export enum LoyaltyTransactionType {
  EARNED = 'earned',
  REDEEMED = 'redeemed',
  EXPIRED = 'expired',
  ADJUSTED = 'adjusted',
}

@Entity('loyalty_transactions')
export class LoyaltyTransaction extends TenantBaseEntity {
  @Column({ name: 'customer_id' })
  customerId: string;

  @Column({ type: 'enum', enum: LoyaltyTransactionType, name: 'transaction_type' })
  transactionType: LoyaltyTransactionType;

  @Column({ type: 'int' })
  points: number;

  @Column({ name: 'reference_id', nullable: true })
  referenceId: string;

  @Column({ name: 'reference_type', nullable: true })
  referenceType: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'expires_at', nullable: true, type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'balance_after', type: 'int' })
  balanceAfter: number;
}

@Entity('loyalty_settings')
export class LoyaltySettings extends TenantBaseEntity {
  @Column({ name: 'points_per_currency_unit', type: 'decimal', precision: 5, scale: 2, default: 1 })
  pointsPerCurrencyUnit: number;

  @Column({ name: 'currency_per_point', type: 'decimal', precision: 5, scale: 2, default: 0.01 })
  currencyPerPoint: number;

  @Column({ name: 'min_redeem_points', type: 'int', default: 100 })
  minRedeemPoints: number;

  @Column({ name: 'points_expiry_days', nullable: true, type: 'int' })
  pointsExpiryDays: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
