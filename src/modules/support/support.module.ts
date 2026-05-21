import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupportTicket, SupportTicketReply } from './entities/support-ticket.entity';
import { SupportService } from './support.service';
import { SupportController } from './support.controller';
import { CommonModule } from 'src/common/common.module';

@Module({
  imports: [TypeOrmModule.forFeature([SupportTicket, SupportTicketReply]), CommonModule],
  providers: [SupportService],
  controllers: [SupportController],
  exports: [SupportService],
})
export class SupportModule {}
