import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { TenantBaseEntity } from 'src/common/entities/base.entity';
import { ChatConversation } from './chat-conversation.entity';

export enum ChatRole {
  USER = 'user',
  ASSISTANT = 'assistant',
}

export enum ChatSenderType {
  USER = 'user',       // the shop staff/owner
  ASSISTANT = 'assistant', // the AI
  AGENT = 'agent',     // a human superadmin
}

@Entity('chat_messages')
export class ChatMessage extends TenantBaseEntity {
  @Index()
  @Column({ name: 'conversation_id' })
  conversationId: string;

  @ManyToOne(() => ChatConversation, (c) => c.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation: ChatConversation;

  @Column({ type: 'enum', enum: ChatRole })
  role: ChatRole;

  @Column({ type: 'enum', enum: ChatSenderType, default: ChatSenderType.USER, name: 'sender_type' })
  senderType: ChatSenderType;

  // User id of the sender for USER and AGENT messages (null for the AI)
  @Column({ name: 'sender_id', nullable: true })
  senderId: string;

  @Column({ type: 'text' })
  content: string;

  // Tokens billed for the assistant turn that produced this message (null for user messages)
  @Column({ name: 'input_tokens', nullable: true })
  inputTokens: number;

  @Column({ name: 'output_tokens', nullable: true })
  outputTokens: number;
}
