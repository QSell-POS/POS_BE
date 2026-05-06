import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { StaffService } from './staff.service';
import { StaffController } from './staff.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [StaffController],
  providers: [StaffService],
  exports: [StaffService],
})
export class StaffModule {}
