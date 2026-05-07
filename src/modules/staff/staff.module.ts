import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Shop } from '../shops/entities/shop.entity';
import { StaffService } from './staff.service';
import { StaffController } from './staff.controller';
import { PlanModule } from 'src/common/plans/plan.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, Shop]), PlanModule],
  controllers: [StaffController],
  providers: [StaffService],
  exports: [StaffService],
})
export class StaffModule {}
