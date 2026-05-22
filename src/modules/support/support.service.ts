import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { SupportTicket, SupportTicketReply, TicketStatus, TicketPriority, TicketCategory } from './entities/support-ticket.entity';
import { MailerService } from 'src/common/services/mailer.service';
import { buildPaginationMeta } from 'src/common/dto/pagination.dto';

export class CreateTicketDto {
  @IsString() @IsNotEmpty()
  subject: string;

  @IsString() @IsNotEmpty()
  message: string;

  @IsOptional() @IsEnum(TicketCategory)
  category?: TicketCategory;

  @IsOptional() @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsEmail()
  email?: string;
}

export class UpdateTicketDto {
  @IsOptional() @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsOptional() @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @IsOptional() @IsString()
  assignedTo?: string;

  @IsOptional() @IsString()
  adminNotes?: string;
}

export class ReplyDto {
  @IsString() @IsNotEmpty()
  message: string;
}

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    @InjectRepository(SupportTicket) private tickets: Repository<SupportTicket>,
    @InjectRepository(SupportTicketReply) private replies: Repository<SupportTicketReply>,
    private mailer: MailerService,
  ) {}

  private async generateTicketNumber(): Promise<string> {
    const count = await this.tickets.count();
    return `TKT-${String(count + 1).padStart(5, '0')}`;
  }

  async create(dto: CreateTicketDto, user?: { id: string; organizationId: string; firstName: string; lastName: string; email: string }) {
    const ticketNumber = await this.generateTicketNumber();
    const ticket = await this.tickets.save(
      this.tickets.create({
        ticketNumber,
        organizationId: user?.organizationId ?? null,
        userId: user?.id ?? null,
        name: dto.name ?? (user ? `${user.firstName} ${user.lastName}`.trim() : null),
        email: dto.email ?? user?.email ?? null,
        subject: dto.subject,
        message: dto.message,
        category: dto.category ?? TicketCategory.OTHER,
        priority: dto.priority ?? TicketPriority.MEDIUM,
      }),
    );

    if (ticket.email) {
      this.mailer.sendMail(
        ticket.email,
        `Support Ticket ${ticketNumber} - ${dto.subject}`,
        `<p>Your ticket <strong>${ticketNumber}</strong> has been received. We'll get back to you shortly.</p>`,
      ).catch(err => this.logger.warn('Failed to send ticket confirmation', err));
    }

    return { data: ticket, message: 'Support ticket created successfully' };
  }

  async findAll(filters: { status?: TicketStatus; priority?: TicketPriority; category?: TicketCategory; orgId?: string; page?: number; limit?: number }) {
    const { status, priority, category, orgId, page = 1, limit = 20 } = filters;
    const qb = this.tickets.createQueryBuilder('t').orderBy('t.createdAt', 'DESC');
    if (status)   qb.andWhere('t.status = :status', { status });
    if (priority) qb.andWhere('t.priority = :priority', { priority });
    if (category) qb.andWhere('t.category = :category', { category });
    if (orgId)    qb.andWhere('t.organizationId = :orgId', { orgId });

    const total = await qb.getCount();
    const data  = await qb.skip((page - 1) * limit).take(limit).getMany();
    return { data, message: 'Tickets fetched successfully', meta: buildPaginationMeta(total, page, limit) };
  }

  async findMyTickets(userId: string, page = 1, limit = 20) {
    const [data, total] = await this.tickets.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, message: 'Your tickets', meta: buildPaginationMeta(total, page, limit) };
  }

  async findOne(id: string) {
    const ticket = await this.tickets.findOne({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    const replies = await this.replies.find({ where: { ticketId: id }, order: { createdAt: 'ASC' } });
    return { data: { ...ticket, replies }, message: 'Ticket retrieved successfully' };
  }

  async update(id: string, dto: UpdateTicketDto) {
    const ticket = await this.tickets.findOne({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    Object.assign(ticket, dto);
    if (dto.status === TicketStatus.RESOLVED || dto.status === TicketStatus.CLOSED) {
      ticket.resolvedAt = new Date();
    }
    const saved = await this.tickets.save(ticket);
    return { data: saved, message: 'Ticket updated successfully' };
  }

  async reply(ticketId: string, dto: ReplyDto, sender: { id?: string; name: string; isAdmin: boolean }) {
    const ticket = await this.tickets.findOne({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const reply = await this.replies.save(
      this.replies.create({
        ticketId,
        senderId: sender.id ?? null,
        senderName: sender.name,
        isAdmin: sender.isAdmin,
        message: dto.message,
      }),
    );

    // Notify the other party via email
    const notifyEmail = sender.isAdmin ? ticket.email : null;
    if (notifyEmail) {
      this.mailer.sendMail(
        notifyEmail,
        `Re: ${ticket.subject} [${ticket.ticketNumber}]`,
        `<p>${sender.name} replied:</p><blockquote>${dto.message}</blockquote>`,
      ).catch(err => this.logger.warn('Failed to send reply notification', err));
    }

    return { data: reply, message: 'Reply added successfully' };
  }
}
