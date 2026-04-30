import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { TenantBaseEntity } from 'src/common/entities/base.entity';
import { Customer } from './customer.entity';

export enum CustomerLedgerType {
  SALE_CREDIT = 'sale_credit',           // customer owes us (credit sale)
  PAYMENT_RECEIVED = 'payment_received', // customer paid us
  SALE_RETURN_CREDIT = 'sale_return_credit', // we owe customer (return credited to account)
  ADJUSTMENT = 'adjustment',
}

@Entity('customer_ledger')
@Index(['shopId', 'customerId'])
export class CustomerLedger extends TenantBaseEntity {
  @Column({ name: 'customer_id' })
  customerId: string;

  @Column({ type: 'enum', enum: CustomerLedgerType })
  type: CustomerLedgerType;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'balance_after' })
  balanceAfter: number;

  @Column({ name: 'reference_type', length: 50, nullable: true })
  referenceType: string;

  @Column({ name: 'reference_id', nullable: true })
  referenceId: string;

  @Column({ nullable: true, type: 'text' })
  description: string;

  @Column({ name: 'created_by', nullable: true })
  createdBy: string;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;
}
