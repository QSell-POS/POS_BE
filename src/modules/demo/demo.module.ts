import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DemoService } from './demo.service';
import { DemoController } from './demo.controller';
import { DemoRequest } from './entities/demo-request.entity';
import { CommonModule } from 'src/common/common.module';

@Module({
  imports: [TypeOrmModule.forFeature([DemoRequest]), CommonModule],
  providers: [DemoService],
  controllers: [DemoController],
})
export class DemoModule {}
