import { Entity, Column, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';

export enum TransferStatus {
  PENDING = 'pending',
  IN_TRANSIT = 'in_transit',
  RECEIVED = 'received',
  CANCELLED = 'cancelled',
}

@Entity('stock_transfers')
export class StockTransfer extends BaseEntity {
  @Column({ name: 'from_shop_id' })
  fromShopId: string;

  @Column({ name: 'to_shop_id' })
  toShopId: string;

  @Column({ name: 'reference_number', unique: true })
  referenceNumber: string;

  @Column({ type: 'enum', enum: TransferStatus, default: TransferStatus.PENDING })
  status: TransferStatus;

  @Column({ name: 'transferred_by' })
  transferredBy: string;

  @Column({ name: 'received_by', nullable: true })
  receivedBy: string;

  @Column({ name: 'sent_at', nullable: true, type: 'timestamptz' })
  sentAt: Date;

  @Column({ name: 'received_at', nullable: true, type: 'timestamptz' })
  receivedAt: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @OneToMany(() => StockTransferItem, (item) => item.transfer, { cascade: true })
  items: StockTransferItem[];
}

@Entity('stock_transfer_items')
export class StockTransferItem extends BaseEntity {
  @Column({ name: 'transfer_id' })
  transferId: string;

  @Column({ name: 'product_id' })
  productId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'received_quantity' })
  receivedQuantity: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @ManyToOne(() => StockTransfer, (t) => t.items)
  @JoinColumn({ name: 'transfer_id' })
  transfer: StockTransfer;
}
