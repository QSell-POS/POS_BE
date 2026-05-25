import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({ description: 'The user message to send to the assistant' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  message: string;

  @ApiPropertyOptional({ description: 'Existing conversation id. Omit to start a new conversation.' })
  @IsOptional()
  @IsUUID()
  conversationId?: string;
}

export class AgentReplyDto {
  @ApiProperty({ description: 'Support agent reply text' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  message: string;
}
