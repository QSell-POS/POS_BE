import { Module, Global } from '@nestjs/common';
import { MailerService } from './services/mailer.service';
import { ReferenceNumberService } from './services/reference-number.service';
import { StorageService } from './services/storage.service';

@Global()
@Module({
  providers: [MailerService, ReferenceNumberService, StorageService],
  exports: [MailerService, ReferenceNumberService, StorageService],
})
export class CommonModule {}
