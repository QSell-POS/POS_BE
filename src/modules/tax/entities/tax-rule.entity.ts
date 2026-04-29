import { Entity, Column } from 'typeorm';
import { TenantBaseEntity } from 'src/common/entities/base.entity';

export enum TaxType {
  PERCENTAGE = 'percentage',
  FIXED = 'fixed',
}

@Entity('tax_rules')
export class TaxRule extends TenantBaseEntity {
  @Column({ length: 100 })
  name: string;

  @Column({ length: 20 })
  code: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  rate: number;

  @Column({ type: 'enum', enum: TaxType, default: TaxType.PERCENTAGE })
  type: TaxType;

  @Column({ name: 'is_default', default: false })
  isDefault: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ nullable: true })
  description: string;

  @Column({ name: 'apply_to_category_id', nullable: true })
  applyToCategoryId: string;
}
