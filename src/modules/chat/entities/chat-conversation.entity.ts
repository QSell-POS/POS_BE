import { Entity, Column, OneToMany, Index } from 'typeorm';
import { TenantBaseEntity } from 'src/common/entities/base.entity';
import { ChatMessage } from './chat-message.entity';

export enum ChatConversationStatus {
  ACTIVE = 'active',
  ESCALATED = 'escalated',
  CLOSED = 'closed',
}

export enum ChatConversationMode {
  AI = 'ai',
  HUMAN = 'human',
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

  // ai = answered by the assistant; human = live chat with a superadmin agent
  @Column({ type: 'enum', enum: ChatConversationMode, default: ChatConversationMode.AI })
  mode: ChatConversationMode;

  // Superadmin currently handling this conversation (human mode)
  @Column({ name: 'assigned_agent_id', nullable: true })
  assignedAgentId: string;

  // Set when the conversation is handed off to a human support ticket
  @Column({ name: 'escalated_ticket_id', nullable: true })
  escalatedTicketId: string;

  @OneToMany(() => ChatMessage, (m) => m.conversation)
  messages: ChatMessage[];
}
