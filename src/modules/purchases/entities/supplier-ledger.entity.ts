import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { TenantBaseEntity } from 'src/common/entities/base.entity';
import { Supplier } from './supplier.entity';
import { LedgerDirection } from 'src/modules/sales/entities/customer-ledger.entity';

export enum SupplierLedgerType {
  PURCHASE_DEBIT = 'purchase_debit',
  PAYMENT_SENT = 'payment_sent',
  PAYMENT_RECEIVED = 'payment_received',
  PURCHASE_RETURN_CREDIT = 'purchase_return_credit',
  ADJUSTMENT = 'adjustment',
}

export { LedgerDirection };

@Entity('supplier_ledger')
@Index(['shopId', 'supplierId'])
export class SupplierLedger extends TenantBaseEntity {
  @Column({ name: 'supplier_id' })
  supplierId: string;

  @Column({ type: 'enum', enum: SupplierLedgerType })
  type: SupplierLedgerType;

  @Column({ type: 'enum', enum: LedgerDirection })
  direction: LedgerDirection;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'running_balance' })
  runningBalance: number;

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
