import { Entity, Column } from 'typeorm';
import { TenantBaseEntity } from 'src/common/entities/base.entity';

@Entity('audit_logs')
export class AuditLog extends TenantBaseEntity {
  @Column({ name: 'user_id', nullable: true })
  userId: string;

  @Column({ length: 50 })
  action: string;

  @Column({ length: 100 })
  entity: string;

  @Column({ name: 'entity_id', nullable: true })
  entityId: string;

  @Column({ type: 'jsonb', nullable: true })
  changes: Record<string, any>;

  @Column({ length: 20, nullable: true })
  method: string;

  @Column({ nullable: true })
  path: string;

  @Column({ name: 'ip_address', nullable: true, length: 45 })
  ipAddress: string;

  @Column({ name: 'user_agent', nullable: true, type: 'text' })
  userAgent: string;
}
