import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { TenantBaseEntity } from 'src/common/entities/base.entity';
import { Customer } from './customer.entity';
import { Sale } from './sale.entity';

export enum SaleReturnStatus {
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum RefundMethod {
  CASH = 'cash',
  CARD = 'card',
  MOBILE_PAYMENT = 'mobile_payment',
  BANK_TRANSFER = 'bank_transfer',
  STORE_CREDIT = 'store_credit',
  APPLIED_TO_DUE = 'applied_to_due',
}

export enum RefundStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
}

@Entity('sale_returns')
export class SaleReturn extends TenantBaseEntity {
  @Column({ name: 'reference_number', length: 50 })
  referenceNumber: string;

  @Column({ name: 'sale_id' })
  saleId: string;

  @Column({ name: 'customer_id', nullable: true })
  customerId: string;

  @Column({ type: 'enum', enum: SaleReturnStatus, default: SaleReturnStatus.COMPLETED })
  status: SaleReturnStatus;

  @Column({ type: 'enum', enum: RefundMethod, default: RefundMethod.CASH, name: 'refund_method' })
  refundMethod: RefundMethod;

  @Column({ type: 'enum', enum: RefundStatus, default: RefundStatus.COMPLETED, name: 'refund_status' })
  refundStatus: RefundStatus;

  @Column({ name: 'return_date', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  returnDate: Date;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'total_amount' })
  totalAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'refunded_amount' })
  refundedAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'applied_to_due_amount' })
  appliedToDueAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'store_credit_issued' })
  storeCreditIssued: number;

  @Column({ nullable: true, type: 'text' })
  reason: string;

  @Column({ nullable: true, type: 'text' })
  notes: string;

  @Column({ name: 'created_by', nullable: true })
  createdBy: string;

  @ManyToOne(() => Sale)
  @JoinColumn({ name: 'sale_id' })
  sale: Sale;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @OneToMany(() => SaleReturnItem, (item) => item.saleReturn, { cascade: true })
  items: SaleReturnItem[];
}

@Entity('sale_return_items')
export class SaleReturnItem extends TenantBaseEntity {
  @Column({ name: 'sale_return_id' })
  saleReturnId: string;

  @Column({ name: 'product_id' })
  productId: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  quantity: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'unit_price' })
  unitPrice: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'subtotal' })
  subtotal: number;

  @Column({ nullable: true, type: 'text' })
  reason: string;

  @ManyToOne(() => SaleReturn, (sr) => sr.items)
  @JoinColumn({ name: 'sale_return_id' })
  saleReturn: SaleReturn;
}
