import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  OnGatewayConnection, MessageBody, ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { UserRole } from 'src/modules/users/entities/user.entity';
import { ChatService } from './chat.service';

interface SocketUser {
  id: string;
  role: UserRole;
  shopId?: string;
}

const room = (conversationId: string) => `conv:${conversationId}`;
const AGENTS_ROOM = 'support:agents';

@WebSocketGateway({ namespace: '/chat', cors: { origin: true, credentials: true } })
export class ChatGateway implements OnGatewayConnection {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer() server: Server;

  constructor(
    private readonly chat: ChatService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.headers?.authorization as string)?.replace(/^Bearer\s+/i, '');
      if (!token) throw new Error('missing token');

      const payload = await this.jwt.verifyAsync(token, {
        secret: this.config.get<string>('jwt.secret'),
      });
      const user: SocketUser = { id: payload.sub, role: payload.role, shopId: payload.shopId };
      client.data.user = user;

      // Superadmins listen on the shared support channel for any new activity.
      if (user.role === UserRole.SUPER_ADMIN) client.join(AGENTS_ROOM);
    } catch (err) {
      this.logger.warn(`Rejecting socket ${client.id}: ${(err as Error).message}`);
      client.emit('chat:error', { message: 'Unauthorized' });
      client.disconnect(true);
    }
  }

  private isAgent(client: Socket): boolean {
    return (client.data.user as SocketUser)?.role === UserRole.SUPER_ADMIN;
  }

  @SubscribeMessage('chat:join')
  async onJoin(@ConnectedSocket() client: Socket, @MessageBody() body: { conversationId: string }) {
    const user = client.data.user as SocketUser;
    if (!body?.conversationId) return { ok: false, error: 'conversationId required' };
    try {
      // Ownership/role check happens in the service read.
      await this.chat.getConversation(body.conversationId, user.id, this.isAgent(client));
      client.join(room(body.conversationId));
      return { ok: true };
    } catch {
      return { ok: false, error: 'Cannot join conversation' };
    }
  }

  @SubscribeMessage('chat:user_message')
  async onUserMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId?: string; message: string },
  ) {
    const user = client.data.user as SocketUser;
    if (!body?.message?.trim()) return { ok: false, error: 'message required' };

    const { conversation, message } = await this.chat.recordUserMessage(
      body.conversationId,
      user.id,
      user.shopId,
      body.message.trim(),
    );

    client.join(room(conversation.id));
    const view = this.chat.toMessageView(message);
    this.server.to(room(conversation.id)).emit('chat:message', { conversationId: conversation.id, message: view });
    // Wake any connected superadmins so the conversation surfaces in their inbox.
    this.server.to(AGENTS_ROOM).emit('chat:conversation_activity', {
      conversationId: conversation.id,
      mode: conversation.mode,
      preview: view.content.slice(0, 120),
    });
    return { ok: true, conversationId: conversation.id, message: view };
  }

  @SubscribeMessage('chat:agent_message')
  async onAgentMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId: string; message: string },
  ) {
    if (!this.isAgent(client)) return { ok: false, error: 'Forbidden' };
    const user = client.data.user as SocketUser;
    if (!body?.conversationId || !body?.message?.trim()) return { ok: false, error: 'conversationId and message required' };

    const { conversation, message } = await this.chat.recordAgentReply(body.conversationId, user.id, body.message.trim());
    client.join(room(conversation.id));
    const view = this.chat.toMessageView(message);
    this.server.to(room(conversation.id)).emit('chat:message', { conversationId: conversation.id, message: view });
    return { ok: true, message: view };
  }

  /** Broadcast helper so REST-side actions (e.g. AI reply, escalation) can push live updates. */
  emitMessage(conversationId: string, message: any) {
    this.server?.to(room(conversationId)).emit('chat:message', { conversationId, message });
  }

  emitAgentActivity(conversationId: string, payload: any) {
    this.server?.to(AGENTS_ROOM).emit('chat:conversation_activity', { conversationId, ...payload });
  }
}
