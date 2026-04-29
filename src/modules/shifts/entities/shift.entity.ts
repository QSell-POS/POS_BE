import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { TenantBaseEntity } from 'src/common/entities/base.entity';
import { User } from 'src/modules/users/entities/user.entity';

export enum ShiftStatus {
  OPEN = 'open',
  CLOSED = 'closed',
}

@Entity('shifts')
export class Shift extends TenantBaseEntity {
  @Column({ name: 'opened_by' })
  openedBy: string;

  @Column({ name: 'closed_by', nullable: true })
  closedBy: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'opening_cash' })
  openingCash: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'closing_cash' })
  closingCash: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'total_sales' })
  totalSales: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'total_cash_sales' })
  totalCashSales: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'cash_difference' })
  cashDifference: number;

  @Column({ type: 'enum', enum: ShiftStatus, default: ShiftStatus.OPEN })
  status: ShiftStatus;

  @Column({ name: 'opened_at', type: 'timestamptz' })
  openedAt: Date;

  @Column({ name: 'closed_at', nullable: true, type: 'timestamptz' })
  closedAt: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'opened_by' })
  openedByUser: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'closed_by' })
  closedByUser: User;
}
