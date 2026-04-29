import { Purchase } from './purchase.entity';
import { Supplier } from './supplier.entity';
import { TenantBaseEntity } from 'src/common/entities/base.entity';
import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';

export enum PurchaseReturnStatus {
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum PurchaseRefundMethod {
  CASH = 'cash',
  BANK_TRANSFER = 'bank_transfer',
  SUPPLIER_CREDIT = 'supplier_credit',
  APPLIED_TO_DUE = 'applied_to_due',
}

export enum PurchaseRefundStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
}

@Entity('purchase_returns')
export class PurchaseReturn extends TenantBaseEntity {
  @Column({ name: 'reference_number', length: 50 })
  referenceNumber: string;

  @Column({ name: 'purchase_id' })
  purchaseId: string;

  @Column({ name: 'supplier_id', nullable: true })
  supplierId: string;

  @Column({ type: 'enum', enum: PurchaseReturnStatus, default: PurchaseReturnStatus.COMPLETED })
  status: PurchaseReturnStatus;

  @Column({ type: 'enum', enum: PurchaseRefundMethod, default: PurchaseRefundMethod.CASH, name: 'refund_method' })
  refundMethod: PurchaseRefundMethod;

  @Column({ type: 'enum', enum: PurchaseRefundStatus, default: PurchaseRefundStatus.COMPLETED, name: 'refund_status' })
  refundStatus: PurchaseRefundStatus;

  @Column({ name: 'return_date', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  returnDate: Date;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'total_amount' })
  totalAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'refunded_amount' })
  refundedAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'applied_to_due_amount' })
  appliedToDueAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'supplier_credit_issued' })
  supplierCreditIssued: number;

  @Column({ nullable: true, type: 'text' })
  reason: string;

  @Column({ nullable: true, type: 'text' })
  notes: string;

  @Column({ name: 'created_by', nullable: true })
  createdBy: string;

  @ManyToOne(() => Purchase)
  @JoinColumn({ name: 'purchase_id' })
  purchase: Purchase;

  @ManyToOne(() => Supplier)
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @OneToMany(() => PurchaseReturnItem, (item) => item.purchaseReturn, { cascade: true })
  items: PurchaseReturnItem[];
}

@Entity('purchase_return_items')
export class PurchaseReturnItem extends TenantBaseEntity {
  @Column({ name: 'purchase_return_id' })
  purchaseReturnId: string;

  @Column({ name: 'product_id' })
  productId: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  quantity: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'unit_cost' })
  unitCost: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'subtotal' })
  subtotal: number;

  @Column({ nullable: true, type: 'text' })
  reason: string;

  @ManyToOne(() => PurchaseReturn, (pr) => pr.items)
  @JoinColumn({ name: 'purchase_return_id' })
  purchaseReturn: PurchaseReturn;
}
