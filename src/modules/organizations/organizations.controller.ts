import { Controller, Get, Put, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard, CurrentUser, Roles } from 'src/common/guards/auth.guard';
import { UserRole } from 'src/modules/users/entities/user.entity';
import { OrgStatus } from './entities/organization.entity';
import { OrganizationsService } from './organizations.service';
import { UpdateOrganizationDto, UpgradePlanDto } from './dto/organization.dto';
import { ShopPlan } from 'src/common/modules/plans/plan.config';

@ApiTags('Organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly orgsService: OrganizationsService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all organizations (super admin)' })
  findAll(
    @Query('search') search: string,
    @Query('plan') plan: ShopPlan,
    @Query('status') status: OrgStatus,
    @Query('page') page: number,
    @Query('limit') limit: number,
  ) {
    return this.orgsService.findAll({ search, plan, status, page, limit });
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get a single organization by ID (super admin)' })
  async findOne(@Param('id') id: string) {
    return this.orgsService.findOne(id);
  }

  @Patch(':id/status')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Activate or suspend an organization (super admin)' })
  updateStatus(@Param('id') id: string, @Body('status') status: OrgStatus) {
    return this.orgsService.updateStatus(id, status);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get my organization with all shops' })
  getMyOrg(@CurrentUser() user: any) {
    return this.orgsService.findMyOrg(user.organizationId);
  }

  @Get('me/shops')
  @ApiOperation({ summary: 'List all shops under my organization' })
  getShops(@CurrentUser() user: any) {
    return this.orgsService.getShops(user.organizationId);
  }

  @Put('me')
  @ApiOperation({ summary: 'Update my organization details' })
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  update(@Body() dto: UpdateOrganizationDto, @CurrentUser() user: any) {
    return this.orgsService.update(user.organizationId, dto, user.id);
  }

  @Patch(':id/plan')
  @ApiOperation({ summary: 'Upgrade organization plan (super admin only)' })
  @Roles(UserRole.SUPER_ADMIN)
  upgradePlan(@Param('id') id: string, @Body() dto: UpgradePlanDto) {
    const expiresAt = dto.planExpiresAt ? new Date(dto.planExpiresAt) : undefined;
    return this.orgsService.upgradePlan(id, dto.plan, expiresAt);
  }
}
