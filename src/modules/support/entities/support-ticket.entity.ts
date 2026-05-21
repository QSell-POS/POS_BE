import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum TicketStatus {
  OPEN       = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED   = 'resolved',
  CLOSED     = 'closed',
}

export enum TicketPriority {
  LOW    = 'low',
  MEDIUM = 'medium',
  HIGH   = 'high',
  URGENT = 'urgent',
}

export enum TicketCategory {
  BILLING    = 'billing',
  TECHNICAL  = 'technical',
  FEATURE    = 'feature',
  ACCOUNT    = 'account',
  OTHER      = 'other',
}

@Entity('support_tickets')
export class SupportTicket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 20, unique: true, name: 'ticket_number' })
  ticketNumber: string;

  @Index()
  @Column({ nullable: true, name: 'organization_id' })
  organizationId: string;

  @Column({ nullable: true, name: 'user_id' })
  userId: string;

  // For non-authenticated submitters
  @Column({ nullable: true, length: 100 })
  name: string;

  @Column({ nullable: true, length: 100 })
  email: string;

  @Column({ length: 200 })
  subject: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'enum', enum: TicketStatus, default: TicketStatus.OPEN })
  status: TicketStatus;

  @Column({ type: 'enum', enum: TicketPriority, default: TicketPriority.MEDIUM })
  priority: TicketPriority;

  @Column({ type: 'enum', enum: TicketCategory, default: TicketCategory.OTHER })
  category: TicketCategory;

  @Column({ nullable: true, name: 'assigned_to' })
  assignedTo: string; // super admin user id

  @Column({ nullable: true, type: 'text', name: 'admin_notes' })
  adminNotes: string;

  @Column({ nullable: true, name: 'resolved_at' })
  resolvedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('support_ticket_replies')
export class SupportTicketReply {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'ticket_id' })
  ticketId: string;

  @Column({ name: 'sender_id', nullable: true })
  senderId: string;

  @Column({ name: 'sender_name', nullable: true, length: 100 })
  senderName: string;

  @Column({ default: false, name: 'is_admin' })
  isAdmin: boolean;

  @Column({ type: 'text' })
  message: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
