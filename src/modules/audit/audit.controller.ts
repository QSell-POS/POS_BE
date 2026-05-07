import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard, CurrentUser, Roles, Permissions } from 'src/common/guards/auth.guard';
import { Permission } from 'src/common/permissions/permission.enum';
import { UserRole } from 'src/modules/users/entities/user.entity';
import { AuditService } from './audit.service';
import { AuditFilterDto } from './dto/audit-filter.dto';

@ApiTags('Audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Permissions(Permission.AUDIT_VIEW)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get audit logs for current shop (Admin/Super Admin only)' })
  findAll(@Query() filters: AuditFilterDto, @CurrentUser() user: any) {
    return this.auditService.findAll(user.shopId, filters);
  }
}
