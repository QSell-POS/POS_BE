import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoyaltyTransaction, LoyaltySettings } from './entities/loyalty.entity';
import { Customer } from 'src/modules/sales/entities/customer.entity';
import { LoyaltyService } from './loyalty.service';
import { LoyaltyController } from './loyalty.controller';
import { PlanModule } from 'src/common/plans/plan.module';

@Module({
  imports: [TypeOrmModule.forFeature([LoyaltyTransaction, LoyaltySettings, Customer]), PlanModule],
  controllers: [LoyaltyController],
  providers: [LoyaltyService],
  exports: [LoyaltyService],
})
export class LoyaltyModule {}
