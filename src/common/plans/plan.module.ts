import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Shop } from 'src/modules/shops/entities/shop.entity';
import { PlanService } from './plan.service';
import { PlanGuard } from './plan.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Shop])],
  providers: [PlanService, PlanGuard],
  exports: [PlanService, PlanGuard],
})
export class PlanModule {}
