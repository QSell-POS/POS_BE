import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { TenantBaseEntity } from 'src/common/entities/base.entity';
import { ApiProperty } from '@nestjs/swagger';
import { User } from 'src/modules/users/entities/user.entity';
import { ExpenseType } from './expense-type.entity';

@Entity('expenses')
@Index(['shopId', 'transactionDate'])
@Index(['shopId', 'expenseTypeId'])
export class Expense extends TenantBaseEntity {
  @ApiProperty()
  @Column({ name: 'expense_type_id', nullable: true })
  expenseTypeId: string;

  @ManyToOne(() => ExpenseType)
  @JoinColumn({ name: 'expense_type_id' })
  expenseType: ExpenseType;

  @ApiProperty()
  @Column({ length: 200 })
  title: string;

  @ApiProperty()
  @Column({ nullable: true, type: 'text' })
  description: string;

  @ApiProperty()
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @ApiProperty()
  @Column({ name: 'transaction_date', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  transactionDate: Date;

  @ApiProperty()
  @Column({ nullable: true, name: 'reference_id' })
  referenceId: string;

  @ApiProperty()
  @Column({ nullable: true, name: 'reference_type', length: 50 })
  referenceType: string;

  @ApiProperty()
  @Column({ nullable: true, length: 255 })
  attachment: string;

  @ApiProperty()
  @Column({ nullable: true, type: 'text' })
  notes: string;

  @ApiProperty()
  @Column({ name: 'recorded_by' })
  recordedBy: string;

  @ManyToOne(() => User, (user) => user.expenses)
  @JoinColumn({ name: 'recorded_by' })
  recordedByUser: User;
}
