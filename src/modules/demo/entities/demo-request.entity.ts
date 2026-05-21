import { Entity, Column, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

@Entity('demo_requests')
export class DemoRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 100 })
  email: string;

  @Column({ nullable: true, length: 20 })
  phone: string;

  @Column({ nullable: true, length: 100 })
  company: string;

  @Column({ nullable: true, type: 'text' })
  message: string;

  @Column({ default: false })
  contacted: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
