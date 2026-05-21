import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { DemoRequest } from './entities/demo-request.entity';
import { BookDemoDto } from './dto/demo.dto';
import { MailerService } from 'src/common/services/mailer.service';

@Injectable()
export class DemoService {
  private readonly logger = new Logger(DemoService.name);

  constructor(
    @InjectRepository(DemoRequest) private repo: Repository<DemoRequest>,
    private mailer: MailerService,
    private config: ConfigService,
  ) {}

  async bookDemo(dto: BookDemoDto) {
    const request = await this.repo.save(dto);

    const adminEmail = this.config.get<string>('mailer.user');
    if (adminEmail) {
      const html = `
        <h2>New Demo Request</h2>
        <p><strong>Name:</strong> ${dto.name}</p>
        <p><strong>Email:</strong> ${dto.email}</p>
        ${dto.phone ? `<p><strong>Phone:</strong> ${dto.phone}</p>` : ''}
        ${dto.company ? `<p><strong>Company:</strong> ${dto.company}</p>` : ''}
        ${dto.message ? `<p><strong>Message:</strong> ${dto.message}</p>` : ''}
      `;
      this.mailer.sendMail(adminEmail, 'New Demo Request - QSell POS', html).catch(err =>
        this.logger.warn('Failed to send demo notification email', err),
      );
    }

    return { message: 'Demo request submitted. We will contact you shortly.', id: request.id };
  }

  async findAll() {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async markContacted(id: string) {
    await this.repo.update(id, { contacted: true });
    return { message: 'Marked as contacted' };
  }
}
