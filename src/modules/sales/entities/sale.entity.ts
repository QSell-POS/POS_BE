import { Entity, Column, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';
import { TenantBaseEntity } from 'src/common/entities/base.entity';
import { Customer } from './customer.entity';
import { Product } from 'src/modules/products/entities/product.entity';
import { User } from 'src/modules/users/entities/user.entity';

export enum SaleStatus {
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum PaymentMethod {
  CASH = 'cash',
  CARD = 'card',
  MOBILE_PAYMENT = 'mobile_payment',
  BANK_TRANSFER = 'bank_transfer',
  CREDIT = 'credit',
  MIXED = 'mixed',
}

@Entity('sales')
@Index(['shopId', 'saleDate'])
@Index(['shopId', 'status'])
@Index(['invoiceNumber'])
export class Sale extends TenantBaseEntity {
  @Column({ name: 'invoice_number', length: 50 })
  invoiceNumber: string;

  @Column({ name: 'customer_id', nullable: true })
  customerId: string;

  @Column({ type: 'enum', enum: SaleStatus, default: SaleStatus.COMPLETED })
  status: SaleStatus;

  @Column({ type: 'enum', enum: PaymentMethod, default: PaymentMethod.CASH, name: 'payment_method' })
  paymentMethod: PaymentMethod;

  @Column({ name: 'sale_date', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  saleDate: Date;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'tax_amount' })
  taxAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'discount_amount' })
  discountAmount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0, name: 'discount_rate' })
  discountRate: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'grand_total' })
  grandTotal: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'credit_amount' })
  creditAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'paid_amount' })
  paidAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'due_amount' })
  dueAmount: number;

  @Column({ length: 50, default: 'unpaid', name: 'payment_status' })
  paymentStatus: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'profit' })
  profit: number;

  @Column({ name: 'served_by', nullable: true })
  servedByUserId: string;

  @Column({ nullable: true, type: 'text' })
  notes: string;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'served_by' })
  servedByUser: User;

  @OneToMany(() => SaleItem, (item) => item.sale, { cascade: true })
  items: SaleItem[];
}

@Entity('sale_items')
export class SaleItem extends TenantBaseEntity {
  @Column({ name: 'sale_id' })
  saleId: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  quantity: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'unit_price' })
  unitPrice: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'cost_price' })
  costPrice: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0, name: 'tax_rate' })
  taxRate: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'tax_amount' })
  taxAmount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0, name: 'discount_rate' })
  discountRate: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'discount_amount' })
  discountAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  profit: number;

  @ManyToOne(() => Sale, (sale) => sale.items)
  @JoinColumn({ name: 'sale_id' })
  sale: Sale;

  @ManyToOne(() => Product, (product) => product.saleItems)
  @JoinColumn({ name: 'product_id' })
  product: Product;
}
