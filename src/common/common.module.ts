import { Module, Global } from '@nestjs/common';
import { MailerService } from './services/mailer.service';
import { ReferenceNumberService } from './services/reference-number.service';

@Global()
@Module({
  providers: [MailerService, ReferenceNumberService],
  exports: [MailerService, ReferenceNumberService],
})
export class CommonModule {}
