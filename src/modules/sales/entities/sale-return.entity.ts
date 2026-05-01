import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { TenantBaseEntity } from 'src/common/entities/base.entity';
import { Customer } from './customer.entity';
import { Sale } from './sale.entity';

export enum SaleReturnStatus {
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
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

  @Column({ name: 'return_date', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  returnDate: Date;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'total_amount' })
  totalAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'amount_paid_to_customer' })
  amountPaidToCustomer: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'amount_to_account' })
  amountToAccount: number;

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
