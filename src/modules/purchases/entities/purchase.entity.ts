import { Supplier } from './supplier.entity';
import { PurchaseItem } from './purchase-item.entity';
import { TenantBaseEntity } from 'src/common/entities/base.entity';
import { Entity, Column, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';

export enum PurchaseStatus {
  DRAFT = 'draft',
  ORDERED = 'ordered',
  PARTIAL = 'partial',
  RECEIVED = 'received',
  CANCELLED = 'cancelled',
}

export enum PaymentStatus {
  PAID = 'paid',
  PENDING = 'pending',
  PARTIAL = 'partial',
  OVERDUE = 'overdue',
}

@Entity('purchases')
@Index(['shopId', 'status'])
@Index(['shopId', 'supplierId'])
@Index(['referenceNumber'])
export class Purchase extends TenantBaseEntity {
  @Column({ name: 'reference_number', unique: false, length: 50 })
  referenceNumber: string;

  @Column({ name: 'supplier_id', nullable: true })
  supplierId: string;

  @Column({ type: 'enum', enum: PurchaseStatus, default: PurchaseStatus.DRAFT })
  status: PurchaseStatus;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
    name: 'payment_status',
  })
  paymentStatus: PaymentStatus;

  @Column({
    name: 'purchase_date',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  purchaseDate: Date;

  @Column({ name: 'expected_date', nullable: true, type: 'timestamp' })
  expectedDate: Date;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    name: 'subtotal',
  })
  subtotal: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    name: 'tax_amount',
  })
  taxAmount: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    name: 'discount_amount',
  })
  discountAmount: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    name: 'shipping_cost',
  })
  shippingCost: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    name: 'grand_total',
  })
  grandTotal: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    name: 'paid_amount',
  })
  paidAmount: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    name: 'due_amount',
  })
  dueAmount: number;

  @Column({ name: 'created_by', nullable: true })
  createdBy: string;

  @Column({ nullable: true, type: 'text' })
  notes: string;

  @Column({ nullable: true, length: 255, name: 'attachment' })
  attachment: string;

  @ManyToOne(() => Supplier)
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @OneToMany(() => PurchaseItem, (item) => item.purchase, { cascade: true })
  items: PurchaseItem[];
}
