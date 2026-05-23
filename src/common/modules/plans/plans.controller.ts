import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard, Roles } from 'src/common/guards/auth.guard';
import { UserRole } from 'src/modules/users/entities/user.entity';
import { PlanAdminService } from './plan-admin.service';
import { CreatePlanDto, UpdatePlanDto } from './dto/plan.dto';

@ApiTags('Plans')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('plans')
export class PlansController {
  constructor(private readonly plans: PlanAdminService) {}

  @Get()
  @ApiOperation({ summary: 'List all plans' })
  findAll() {
    return this.plans.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a plan by id' })
  findOne(@Param('id') id: string) {
    return this.plans.findOne(id);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a plan (super admin)' })
  create(@Body() dto: CreatePlanDto) {
    return this.plans.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a plan / toggle active (super admin)' })
  update(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.plans.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a plan (super admin)' })
  remove(@Param('id') id: string) {
    return this.plans.remove(id);
  }
}
