import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, Roles, RolesGuard, Public, CurrentUser } from 'src/common/guards/auth.guard';
import { UserRole } from '../users/entities/user.entity';
import { SupportService, CreateTicketDto, UpdateTicketDto, ReplyDto } from './support.service';
import { TicketStatus, TicketPriority, TicketCategory } from './entities/support-ticket.entity';

@ApiTags('Support')
@Controller('support-tickets')
export class SupportController {
  constructor(private readonly service: SupportService) {}

  // ── Public: anyone can submit a ticket ──────────────────────────────────────
  @Public()
  @Post()
  create(@Body() dto: CreateTicketDto, @CurrentUser() user: any) {
    return this.service.create(dto, user ?? undefined);
  }

  // ── Authenticated: user's own tickets ────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Get('my')
  myTickets(@CurrentUser() user: any, @Query('page') page: number, @Query('limit') limit: number) {
    return this.service.findMyTickets(user.sub, page, limit);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/replies')
  reply(@Param('id') ticketId: string, @Body() dto: ReplyDto, @CurrentUser() user: any) {
    const isAdmin = user?.role === UserRole.SUPER_ADMIN;
    return this.service.reply(ticketId, dto, {
      id: user?.sub,
      name: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || 'User',
      isAdmin,
    });
  }

  // ── Super admin only ─────────────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Get()
  findAll(
    @Query('status') status: TicketStatus,
    @Query('priority') priority: TicketPriority,
    @Query('category') category: TicketCategory,
    @Query('orgId') orgId: string,
    @Query('page') page: number,
    @Query('limit') limit: number,
  ) {
    return this.service.findAll({ status, priority, category, orgId, page, limit });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTicketDto) {
    return this.service.update(id, dto);
  }
}
