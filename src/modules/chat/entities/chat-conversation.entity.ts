import { Entity, Column, OneToMany, Index } from 'typeorm';
import { TenantBaseEntity } from 'src/common/entities/base.entity';
import { ChatMessage } from './chat-message.entity';

export enum ChatConversationStatus {
  ACTIVE = 'active',
  ESCALATED = 'escalated',
  CLOSED = 'closed',
}

@Entity('chat_conversations')
export class ChatConversation extends TenantBaseEntity {
  @Index()
  @Column({ name: 'user_id' })
  userId: string;

  @Column({ nullable: true, length: 200 })
  title: string;

  @Column({ type: 'enum', enum: ChatConversationStatus, default: ChatConversationStatus.ACTIVE })
  status: ChatConversationStatus;

  // Set when the conversation is handed off to a human support ticket
  @Column({ name: 'escalated_ticket_id', nullable: true })
  escalatedTicketId: string;

  @OneToMany(() => ChatMessage, (m) => m.conversation)
  messages: ChatMessage[];
}
