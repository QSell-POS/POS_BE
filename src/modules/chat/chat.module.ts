import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatConversation } from './entities/chat-conversation.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatAiService } from './chat-ai.service';

@Module({
  imports: [TypeOrmModule.forFeature([ChatConversation, ChatMessage])],
  controllers: [ChatController],
  providers: [ChatService, ChatAiService],
  exports: [ChatService, ChatAiService],
})
export class ChatModule {}
