import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { DemoService } from './demo.service';
import { BookDemoDto } from './dto/demo.dto';
import { Public } from 'src/common/guards/auth.guard';
import { Roles } from 'src/common/guards/auth.guard';
import { UserRole } from '../users/entities/user.entity';

@Controller('demo-requests')
export class DemoController {
  constructor(private readonly demoService: DemoService) {}

  @Public()
  @Post()
  bookDemo(@Body() dto: BookDemoDto) {
    return this.demoService.bookDemo(dto);
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Get()
  findAll() {
    return this.demoService.findAll();
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Patch(':id/contacted')
  markContacted(@Param('id') id: string) {
    return this.demoService.markContacted(id);
  }
}
