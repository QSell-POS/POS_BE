import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoiceService } from './invoice.service';
import { InvoiceController } from './invoice.controller';
import { Sale } from '../sales/entities/sale.entity';
import { Shop } from '../shops/entities/shop.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { PlanModule } from 'src/common/modules/plans/plan.module';
import { CommonModule } from 'src/common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Sale, Shop, Organization]),
    PlanModule,
    CommonModule,
  ],
  providers: [InvoiceService],
  controllers: [InvoiceController],
  exports: [InvoiceService],
})
export class InvoiceModule {}
