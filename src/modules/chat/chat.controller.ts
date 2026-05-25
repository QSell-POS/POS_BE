import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from 'src/common/guards/auth.guard';
import { UserRole } from 'src/modules/users/entities/user.entity';
import { ChatConversationMode, ChatConversationStatus } from './entities/chat-conversation.entity';
import { ChatService } from './chat.service';
import { ChatAiService } from './chat-ai.service';
import { ChatGateway } from './chat.gateway';
import { SendMessageDto, AgentReplyDto } from './dto/chat.dto';

@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly ai: ChatAiService,
    private readonly gateway: ChatGateway,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Whether the AI assistant is configured/available' })
  status() {
    return { data: { enabled: this.ai.enabled }, message: 'Chat status' };
  }

  @Get('conversations')
  @ApiOperation({ summary: 'List my chat conversations' })
  list(@CurrentUser() user: any) {
    return this.chat.listConversations(user.id, user.shopId);
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get a conversation with its messages' })
  get(@Param('id') id: string, @CurrentUser() user: any) {
    const isAgent = user.role === UserRole.SUPER_ADMIN;
    return this.chat.getConversation(id, user.id, isAgent);
  }

  @Post('messages')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Send a message to the assistant (creates a conversation if none given)' })
  async send(@Body() dto: SendMessageDto, @CurrentUser() user: any) {
    const result = await this.chat.sendMessage(dto, user.id, user.shopId);
    // Push live to anyone watching the conversation room (e.g. a superadmin observing).
    if (result.data.reply) {
      this.gateway.emitMessage(result.data.conversationId, result.data.reply);
    }
    return result;
  }

  @Post('conversations/:id/escalate')
  @ApiOperation({ summary: 'Hand this conversation off to a human support agent' })
  async escalate(@Param('id') id: string, @CurrentUser() user: any) {
    const result = await this.chat.escalateToHuman(id, user.id);
    this.gateway.emitAgentActivity(id, { mode: 'human', escalated: true });
    return result;
  }

  // ── Superadmin support inbox ────────────────────────────────────────────

  @Get('support/inbox')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List conversations in human/live-support mode (super admin)' })
  inbox() {
    return this.chat.listSupportInbox();
  }

  @Get('support/conversations')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List ALL conversations incl. AI-only, with filters (super admin)' })
  allConversations(
    @Query('mode') mode?: ChatConversationMode,
    @Query('status') status?: ChatConversationStatus,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.chat.listAllConversations({
      mode,
      status,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Post('conversations/:id/agent-reply')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Reply to a conversation as a support agent (super admin)' })
  async agentReply(@Param('id') id: string, @Body() dto: AgentReplyDto, @CurrentUser() user: any) {
    const { message } = await this.chat.recordAgentReply(id, user.id, dto.message);
    const view = this.chat.toMessageView(message);
    this.gateway.emitMessage(id, view);
    return { data: { conversationId: id, reply: view }, message: 'Reply sent' };
  }
}
