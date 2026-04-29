import { UnitsService } from './units.service';
import { UserRole } from '../users/entities/user.entity';
import { CreateUnitDto, UnitFilterDto, UpdateUnitDto } from './dto/unit.dto';
import { Get, Body, Post, Param, UseGuards, Controller, Delete, Put, Query } from '@nestjs/common';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from 'src/common/guards/auth.guard';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Units')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('units')
export class UnitsController {
  constructor(private readonly service: UnitsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new unit (admin, manager, or super admin only)' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  create(@Body() dto: CreateUnitDto, @CurrentUser() user: any) {
    return this.service.create(dto, user.shopId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all units for the current shop' })
  findAll(@Query() filters: UnitFilterDto, @CurrentUser() user: any) {
    return this.service.findAll(user.shopId, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a unit by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.findOne(id, user.shopId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a unit' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateUnitDto, @CurrentUser() user: any) {
    return this.service.update(id, dto, user.shopId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a unit' })
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.remove(id, user.shopId);
  }

  @Put(':id/restore')
  @ApiOperation({ summary: 'Restore a soft-deleted unit' })
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  restore(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.restore(id, user.shopId);
  }
}
