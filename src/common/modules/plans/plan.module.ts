import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Shop } from 'src/modules/shops/entities/shop.entity';
import { Organization } from 'src/modules/organizations/entities/organization.entity';
import { Plan } from './entities/plan.entity';
import { PlanService } from './plan.service';
import { PlanAdminService } from './plan-admin.service';
import { PlanGuard } from './plan.guard';
import { PlansController } from './plans.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Shop, Organization, Plan])],
  controllers: [PlansController],
  providers: [PlanService, PlanAdminService, PlanGuard],
  exports: [PlanService, PlanAdminService, PlanGuard],
})
export class PlanModule {}
