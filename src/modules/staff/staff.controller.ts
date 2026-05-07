import {
  Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser, Permissions } from 'src/common/guards/auth.guard';
import { Permission } from 'src/common/permissions/permission.enum';
import { UserRole, UserStatus } from '../users/entities/user.entity';
import { UuidParamPipe } from 'src/common/validator';
import { StaffService } from './staff.service';
import { CreateStaffDto, UpdateStaffDto, SetPermissionsDto, StaffFilterDto, TransferStaffDto } from './staff.dto';

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

  // ── Management endpoints (ADMIN / SUPER_ADMIN only) ──────────────────────

  @Post()
  @Permissions(Permission.STAFF_CREATE)
  @ApiOperation({ summary: 'Create a new staff member (optionally targeting another shop in the same org)' })
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  create(@Body() dto: CreateStaffDto, @CurrentUser() user: any) {
    return this.staffService.create(dto, user.shopId, user.organizationId);
  }

  @Get()
  @Permissions(Permission.STAFF_VIEW)
  @ApiOperation({ summary: 'List staff across the organization (filter by shopId optional)' })
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER)
  findAll(@Query() filters: StaffFilterDto & { shopId?: string }, @CurrentUser() user: any) {
    return this.staffService.findAll(user.organizationId, filters);
  }

  @Get(':id')
  @Permissions(Permission.STAFF_VIEW)
  @ApiOperation({ summary: 'Get a staff member by ID' })
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER)
  findOne(@Param('id', UuidParamPipe) id: string, @CurrentUser() user: any) {
    return this.staffService.findOne(id, user.organizationId);
  }

  @Put(':id')
  @Permissions(Permission.STAFF_UPDATE)
  @ApiOperation({ summary: 'Update staff profile (name, phone, avatar)' })
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  update(
    @Param('id', UuidParamPipe) id: string,
    @Body() dto: UpdateStaffDto,
    @CurrentUser() user: any,
  ) {
    return this.staffService.update(id, dto, user.organizationId);
  }

  @Patch(':id/permissions')
  @Permissions(Permission.STAFF_PERMISSIONS)
  @ApiOperation({ summary: 'Replace all permissions for a staff member' })
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  setPermissions(
    @Param('id', UuidParamPipe) id: string,
    @Body() dto: SetPermissionsDto,
    @CurrentUser() user: any,
  ) {
    return this.staffService.setPermissions(id, dto, user.organizationId);
  }

  @Patch(':id/transfer')
  @Permissions(Permission.STAFF_UPDATE)
  @ApiOperation({ summary: 'Transfer a staff member to another shop in the same organization' })
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  transfer(
    @Param('id', UuidParamPipe) id: string,
    @Body() dto: TransferStaffDto,
    @CurrentUser() user: any,
  ) {
    return this.staffService.transfer(id, dto.shopId, user.organizationId);
  }

  @Patch(':id/activate')
  @Permissions(Permission.STAFF_UPDATE)
  @ApiOperation({ summary: 'Activate a staff member' })
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  activate(@Param('id', UuidParamPipe) id: string, @CurrentUser() user: any) {
    return this.staffService.setStatus(id, UserStatus.ACTIVE, user.organizationId);
  }

  @Patch(':id/deactivate')
  @Permissions(Permission.STAFF_UPDATE)
  @ApiOperation({ summary: 'Deactivate a staff member' })
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  deactivate(@Param('id', UuidParamPipe) id: string, @CurrentUser() user: any) {
    return this.staffService.setStatus(id, UserStatus.INACTIVE, user.organizationId);
  }

  @Delete(':id')
  @Permissions(Permission.STAFF_DELETE)
  @ApiOperation({ summary: 'Remove a staff member (soft delete)' })
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  remove(@Param('id', UuidParamPipe) id: string, @CurrentUser() user: any) {
    return this.staffService.remove(id, user.organizationId);
  }
}
