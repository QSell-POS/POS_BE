import {
  Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from 'src/common/guards/auth.guard';
import { UserRole, UserStatus } from '../users/entities/user.entity';
import { UuidParamPipe } from 'src/common/validator';
import { StaffService } from './staff.service';
import { CreateStaffDto, UpdateStaffDto, SetPermissionsDto, ApplyPresetDto, StaffFilterDto } from './staff.dto';

@ApiTags('Staff')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  // ── Reference endpoints (no auth restriction — any logged-in user can read) ─

  @Get('permissions/list')
  @ApiOperation({ summary: 'List all available permissions with labels and groups' })
  getPermissionsMeta() {
    return this.staffService.getPermissionsMeta();
  }

  @Get('presets')
  @ApiOperation({ summary: 'List all staff presets with their default permissions' })
  getPresets() {
    return this.staffService.getPresets();
  }

  // ── Management endpoints (ADMIN / SUPER_ADMIN only) ──────────────────────

  @Post()
  @ApiOperation({ summary: 'Create a new staff member' })
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  create(@Body() dto: CreateStaffDto, @CurrentUser() user: any) {
    return this.staffService.create(dto, user.shopId);
  }

  @Get()
  @ApiOperation({ summary: 'List all staff for this shop' })
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER)
  findAll(@Query() filters: StaffFilterDto, @CurrentUser() user: any) {
    return this.staffService.findAll(user.shopId, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a staff member by ID' })
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER)
  findOne(@Param('id', UuidParamPipe) id: string, @CurrentUser() user: any) {
    return this.staffService.findOne(id, user.shopId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update staff profile (name, phone, avatar)' })
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  update(
    @Param('id', UuidParamPipe) id: string,
    @Body() dto: UpdateStaffDto,
    @CurrentUser() user: any,
  ) {
    return this.staffService.update(id, dto, user.shopId);
  }

  @Patch(':id/permissions')
  @ApiOperation({ summary: 'Replace all permissions for a staff member' })
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  setPermissions(
    @Param('id', UuidParamPipe) id: string,
    @Body() dto: SetPermissionsDto,
    @CurrentUser() user: any,
  ) {
    return this.staffService.setPermissions(id, dto, user.shopId);
  }

  @Patch(':id/preset')
  @ApiOperation({ summary: 'Apply a preset to a staff member (resets permissions to preset defaults)' })
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  applyPreset(
    @Param('id', UuidParamPipe) id: string,
    @Body() dto: ApplyPresetDto,
    @CurrentUser() user: any,
  ) {
    return this.staffService.applyPreset(id, dto, user.shopId);
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Activate a staff member' })
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  activate(@Param('id', UuidParamPipe) id: string, @CurrentUser() user: any) {
    return this.staffService.setStatus(id, UserStatus.ACTIVE, user.shopId);
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate a staff member' })
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  deactivate(@Param('id', UuidParamPipe) id: string, @CurrentUser() user: any) {
    return this.staffService.setStatus(id, UserStatus.INACTIVE, user.shopId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a staff member (soft delete)' })
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  remove(@Param('id', UuidParamPipe) id: string, @CurrentUser() user: any) {
    return this.staffService.remove(id, user.shopId);
  }
}
