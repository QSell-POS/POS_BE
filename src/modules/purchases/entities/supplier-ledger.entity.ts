import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { TenantBaseEntity } from 'src/common/entities/base.entity';
import { Supplier } from './supplier.entity';

export enum SupplierLedgerType {
  PURCHASE_DEBIT = 'purchase_debit',         // we owe supplier (credit purchase)
  PAYMENT_SENT = 'payment_sent',             // we paid supplier
  PURCHASE_RETURN_CREDIT = 'purchase_return_credit', // supplier owes us (return credited to account)
  ADJUSTMENT = 'adjustment',
}

@Entity('supplier_ledger')
@Index(['shopId', 'supplierId'])
export class SupplierLedger extends TenantBaseEntity {
  @Column({ name: 'supplier_id' })
  supplierId: string;

  @Column({ type: 'enum', enum: SupplierLedgerType })
  type: SupplierLedgerType;

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

  @ManyToOne(() => Supplier)
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;
}
