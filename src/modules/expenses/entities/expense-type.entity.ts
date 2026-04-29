import { Entity, Column, Index } from 'typeorm';
import { TenantBaseEntity } from 'src/common/entities/base.entity';
import { ApiProperty } from '@nestjs/swagger';

@Entity('expense_types')
@Index(['shopId', 'name'], { unique: true })
export class ExpenseType extends TenantBaseEntity {
  @ApiProperty()
  @Column({ length: 100 })
  name: string;

  @ApiProperty()
  @Column({ length: 50, nullable: true })
  code: string;

  @ApiProperty()
  @Column({ nullable: true, type: 'text' })
  description: string;

  @ApiProperty()
  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
