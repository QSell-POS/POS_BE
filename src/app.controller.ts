import { Get, Controller, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, Public } from './common/guards/auth.guard';

@Controller()
@UseGuards(JwtAuthGuard)
export class AppController {
  @Public()
  @Get()
  getHello() {
    return 'Hello World!';
  }
}
