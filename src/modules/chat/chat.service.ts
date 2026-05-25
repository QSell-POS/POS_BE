import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ChatConversation, ChatConversationStatus } from './entities/chat-conversation.entity';
import { ChatMessage, ChatRole } from './entities/chat-message.entity';
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

  async listConversations(userId: string, shopId: string) {
    const data = await this.conversations.find({
      where: { userId, shopId },
      order: { updatedAt: 'DESC' },
    });
    return { data, message: 'Conversations fetched successfully' };
  }

  async getConversation(id: string, userId: string) {
    const conversation = await this.conversations.findOne({ where: { id } });
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (conversation.userId !== userId) throw new ForbiddenException('Not your conversation');

    const messages = await this.messages.find({
      where: { conversationId: id },
      order: { createdAt: 'ASC' },
    });
    return { data: { ...conversation, messages }, message: 'Conversation fetched successfully' };
  }

  async sendMessage(dto: SendMessageDto, userId: string, shopId: string) {
    const conversation = dto.conversationId
      ? await this.loadOwnedConversation(dto.conversationId, userId)
      : await this.conversations.save(
          this.conversations.create({
            userId,
            shopId,
            title: dto.message.slice(0, 80),
            status: ChatConversationStatus.ACTIVE,
          }),
        );

    await this.messages.save(
      this.messages.create({
        conversationId: conversation.id,
        shopId,
        role: ChatRole.USER,
        content: dto.message,
      }),
    );

    const history = await this.buildHistory(conversation.id);
    const reply = await this.ai.reply(history);

    const assistantMessage = await this.messages.save(
      this.messages.create({
        conversationId: conversation.id,
        shopId,
        role: ChatRole.ASSISTANT,
        content: reply.text,
        inputTokens: reply.inputTokens,
        outputTokens: reply.outputTokens,
      }),
    );

    // Touch the conversation so it sorts to the top of the list
    await this.conversations.update(conversation.id, { updatedAt: new Date() });

    return {
      data: {
        conversationId: conversation.id,
        reply: {
          id: assistantMessage.id,
          role: assistantMessage.role,
          content: assistantMessage.content,
          createdAt: assistantMessage.createdAt,
        },
      },
      message: 'Message sent',
    };
  }

  private async loadOwnedConversation(id: string, userId: string): Promise<ChatConversation> {
    const conversation = await this.conversations.findOne({ where: { id } });
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (conversation.userId !== userId) throw new ForbiddenException('Not your conversation');
    return conversation;
  }

  private async buildHistory(conversationId: string): Promise<ChatTurn[]> {
    // Most recent N messages, oldest-first, for the model context window.
    const recent = await this.messages.find({
      where: { conversationId },
      order: { createdAt: 'DESC' },
      take: this.maxHistory,
    });
    const turns = recent
      .reverse()
      .map((m) => ({ role: m.role === ChatRole.USER ? 'user' : 'assistant', content: m.content } as ChatTurn));
    // The Messages API requires the first turn to be 'user' — drop any leading
    // assistant turns left at the window boundary after trimming.
    while (turns.length && turns[0].role === 'assistant') turns.shift();
    return turns;
  }
}
