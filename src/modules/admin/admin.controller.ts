import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from 'src/common/guards/auth.guard';
import { UserRole } from '../users/entities/user.entity';
import { AdminService, CreateTenantDto } from './admin.service';
import { ShopPlan } from 'src/common/modules/plans/plan.config';
import { SubscriptionStatus } from '../subscriptions/entities/subscription.entity';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ── Tenant onboarding ────────────────────────────────────────────────────────
  @Post('tenants')
  createTenant(@Body() dto: CreateTenantDto) {
    return this.adminService.createTenant(dto);
  }

  // ── Impersonation ────────────────────────────────────────────────────────────
  @Post('impersonate/:orgId')
  impersonate(@Param('orgId') orgId: string, @CurrentUser() user: any) {
    return this.adminService.impersonate(orgId, user.sub);
  }

  // ── Revenue dashboard ────────────────────────────────────────────────────────
  @Get('revenue')
  getRevenueDashboard() {
    return this.adminService.getRevenueDashboard();
  }

  // ── All subscriptions ─────────────────────────────────────────────────────────
  @Get('subscriptions')
  getAllSubscriptions(
    @Query('orgId') orgId: string,
    @Query('plan') plan: ShopPlan,
    @Query('status') status: SubscriptionStatus,
    @Query('page') page: number,
    @Query('limit') limit: number,
  ) {
    return this.adminService.getAllSubscriptions({ orgId, plan, status, page, limit });
  }

  // ── Org users & permission management ────────────────────────────────────────
  @Get('orgs/:orgId/users')
  getOrgUsers(@Param('orgId') orgId: string) {
    return this.adminService.getOrgUsers(orgId);
  }

  @Patch('users/:userId/permissions')
  setUserPermissions(@Param('userId') userId: string, @Body('permissions') permissions: string[]) {
    return this.adminService.setUserPermissions(userId, permissions);
  }

  @Patch('users/:userId/role')
  setUserRole(@Param('userId') userId: string, @Body('role') role: UserRole) {
    return this.adminService.setUserRole(userId, role);
  }
}
