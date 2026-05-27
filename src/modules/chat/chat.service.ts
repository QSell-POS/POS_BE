import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ChatConversation, ChatConversationStatus, ChatConversationMode } from './entities/chat-conversation.entity';
import { ChatMessage, ChatRole, ChatSenderType } from './entities/chat-message.entity';
import { ChatAiService, ChatTurn } from './chat-ai.service';
import { SendMessageDto } from './dto/chat.dto';

@Injectable()
export class ChatService {
  private readonly maxHistory: number;

  constructor(
    @InjectRepository(ChatConversation) private readonly conversations: Repository<ChatConversation>,
    @InjectRepository(ChatMessage) private readonly messages: Repository<ChatMessage>,
    private readonly ai: ChatAiService,
    config: ConfigService,
  ) {
    this.maxHistory = config.get<number>('chat.maxHistoryMessages') || 20;
  }

  // ── Reads ───────────────────────────────────────────────────────────────

  async listConversations(userId: string, shopId: string) {
    const data = await this.conversations.find({
      where: { userId, shopId },
      order: { updatedAt: 'DESC' },
    });
    return { data, message: 'Conversations fetched successfully' };
  }

  async getConversation(id: string, userId: string, isAgent = false) {
    const conversation = await this.requireConversation(id);
    if (!isAgent && conversation.userId !== userId) throw new ForbiddenException('Not your conversation');
    const messages = await this.messages.find({ where: { conversationId: id }, order: { createdAt: 'ASC' } });
    return { data: { ...conversation, messages }, message: 'Conversation fetched successfully' };
  }

  /** Superadmin support inbox — conversations escalated to / in human mode. */
  async listSupportInbox() {
    const data = await this.conversations.find({
      where: { mode: ChatConversationMode.HUMAN },
      order: { updatedAt: 'DESC' },
    });
    return { data, message: 'Support inbox fetched successfully' };
  }

  /** Superadmin: list ALL conversations (incl. AI-only), with optional filters + paging. */
  async listAllConversations(opts: { mode?: ChatConversationMode; status?: ChatConversationStatus; search?: string; page?: number; limit?: number }) {
    const page = Math.max(1, opts.page || 1);
    const limit = Math.min(100, Math.max(1, opts.limit || 20));
    const qb = this.conversations.createQueryBuilder('c');
    if (opts.mode) qb.andWhere('c.mode = :mode', { mode: opts.mode });
    if (opts.status) qb.andWhere('c.status = :status', { status: opts.status });
    if (opts.search) qb.andWhere('c.title ILIKE :s', { s: `%${opts.search}%` });
    qb.orderBy('c.updatedAt', 'DESC').skip((page - 1) * limit).take(limit);
    const [data, total] = await qb.getManyAndCount();
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      message: 'Conversations fetched successfully',
    };
  }

  // ── AI path (REST) ────────────────────────────────────────────────────────

  async sendMessage(dto: SendMessageDto, userId: string, shopId: string) {
    const conversation = dto.conversationId
      ? await this.requireOwned(dto.conversationId, userId)
      : await this.createConversation(userId, shopId, dto.message);

    await this.persistUserMessage(conversation, userId, dto.message);

    // If a human has taken over, don't invoke the AI — the agent will reply live.
    if (conversation.mode === ChatConversationMode.HUMAN) {
      await this.touch(conversation.id);
      return {
        data: { conversationId: conversation.id, mode: conversation.mode, reply: null },
        message: 'Message sent to support agent',
      };
    }

    const history = await this.buildHistory(conversation.id);
    const result = await this.ai.reply(history);
    const assistant = await this.messages.save(
      this.messages.create({
        conversationId: conversation.id,
        shopId,
        role: ChatRole.ASSISTANT,
        senderType: ChatSenderType.ASSISTANT,
        content: result.text,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      }),
    );
    await this.touch(conversation.id);

    return {
      data: {
        conversationId: conversation.id,
        mode: conversation.mode,
        reply: this.toMessageView(assistant),
      },
      message: 'Message sent',
    };
  }

  // ── Live human chat (used by the gateway + REST fallback) ──────────────────

  /** Shop user sends a message. Returns the conversation and persisted message. */
  async recordUserMessage(conversationId: string | undefined, userId: string, shopId: string, text: string) {
    const conversation = conversationId
      ? await this.requireOwned(conversationId, userId)
      : await this.createConversation(userId, shopId, text);
    const message = await this.persistUserMessage(conversation, userId, text);
    await this.touch(conversation.id);
    return { conversation, message };
  }

  /** Superadmin replies in a human-mode conversation. */
  async recordAgentReply(conversationId: string, agentId: string, text: string) {
    const conversation = await this.requireConversation(conversationId);
    if (conversation.mode !== ChatConversationMode.HUMAN) {
      await this.conversations.update(conversation.id, {
        mode: ChatConversationMode.HUMAN,
        status: ChatConversationStatus.ESCALATED,
      });
    }
    if (!conversation.assignedAgentId) {
      await this.conversations.update(conversation.id, { assignedAgentId: agentId });
    }
    const message = await this.messages.save(
      this.messages.create({
        conversationId: conversation.id,
        shopId: conversation.shopId,
        role: ChatRole.ASSISTANT,
        senderType: ChatSenderType.AGENT,
        senderId: agentId,
        content: text,
      }),
    );
    await this.touch(conversation.id);
    return { conversation, message };
  }

  /** Shop user (or the system) hands the conversation off to a human. */
  async escalateToHuman(conversationId: string, userId: string) {
    const conversation = await this.requireOwned(conversationId, userId);
    await this.conversations.update(conversation.id, {
      mode: ChatConversationMode.HUMAN,
      status: ChatConversationStatus.ESCALATED,
    });
    const updated = await this.requireConversation(conversationId);
    return { data: updated, message: 'Conversation escalated to support' };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  toMessageView(m: ChatMessage) {
    return {
      id: m.id,
      conversationId: m.conversationId,
      role: m.role,
      senderType: m.senderType,
      senderId: m.senderId,
      content: m.content,
      createdAt: m.createdAt,
    };
  }

  private async createConversation(userId: string, shopId: string, firstMessage: string) {
    return this.conversations.save(
      this.conversations.create({
        userId,
        shopId,
        title: firstMessage.slice(0, 80),
        status: ChatConversationStatus.ACTIVE,
        mode: ChatConversationMode.AI,
      }),
    );
  }

  private persistUserMessage(conversation: ChatConversation, userId: string, text: string) {
    return this.messages.save(
      this.messages.create({
        conversationId: conversation.id,
        shopId: conversation.shopId,
        role: ChatRole.USER,
        senderType: ChatSenderType.USER,
        senderId: userId,
        content: text,
      }),
    );
  }

  private async requireConversation(id: string): Promise<ChatConversation> {
    const conversation = await this.conversations.findOne({ where: { id } });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }

  private async requireOwned(id: string, userId: string): Promise<ChatConversation> {
    const conversation = await this.requireConversation(id);
    if (conversation.userId !== userId) throw new ForbiddenException('Not your conversation');
    return conversation;
  }

  private touch(id: string) {
    return this.conversations.update(id, { updatedAt: new Date() });
  }

  private async buildHistory(conversationId: string): Promise<ChatTurn[]> {
    const recent = await this.messages.find({
      where: { conversationId },
      order: { createdAt: 'DESC' },
      take: this.maxHistory,
    });
    const turns = recent
      .reverse()
      .map((m) => ({ role: m.role === ChatRole.USER ? 'user' : 'assistant', content: m.content } as ChatTurn));
    while (turns.length && turns[0].role === 'assistant') turns.shift();
    return turns;
  }
}
