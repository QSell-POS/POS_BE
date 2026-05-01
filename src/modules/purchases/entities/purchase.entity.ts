import { Supplier } from './supplier.entity';
import { PurchaseItem } from './purchase-item.entity';
import { TenantBaseEntity } from 'src/common/entities/base.entity';
import { Entity, Column, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';

export enum PurchaseStatus {
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
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

  @Column({ type: 'enum', enum: PurchaseStatus, default: PurchaseStatus.COMPLETED })
  status: PurchaseStatus;

  @Column({ name: 'is_received', default: true })
  isReceived: boolean;

  @Column({ name: 'purchase_date', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  purchaseDate: Date;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'subtotal' })
  subtotal: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'tax_amount' })
  taxAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'discount_amount' })
  discountAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'shipping_cost' })
  shippingCost: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'grand_total' })
  grandTotal: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'credit_amount' })
  creditAmount: number;

  @Column({ name: 'supplier_bill_number', nullable: true, length: 100 })
  supplierBillNumber: string;

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
