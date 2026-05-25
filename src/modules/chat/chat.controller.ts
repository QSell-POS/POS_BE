import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard, RolesGuard, CurrentUser } from 'src/common/guards/auth.guard';
import { ChatService } from './chat.service';
import { ChatAiService } from './chat-ai.service';
import { SendMessageDto } from './dto/chat.dto';

@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly ai: ChatAiService,
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
    return this.chat.getConversation(id, user.id);
  }

  @Post('messages')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Send a message to the assistant (creates a conversation if none given)' })
  send(@Body() dto: SendMessageDto, @CurrentUser() user: any) {
    return this.chat.sendMessage(dto, user.id, user.shopId);
  }
}
