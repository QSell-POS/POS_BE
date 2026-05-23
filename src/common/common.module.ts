import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailerService } from './services/mailer.service';
import { ReferenceNumberService } from './services/reference-number.service';
import { StorageService } from './services/storage.service';
import { Shop } from 'src/modules/shops/entities/shop.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Shop])],
  providers: [MailerService, ReferenceNumberService, StorageService],
  exports: [MailerService, ReferenceNumberService, StorageService],
})
export class CommonModule {}
