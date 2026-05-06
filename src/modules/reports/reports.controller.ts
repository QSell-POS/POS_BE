import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard, CurrentUser, Roles } from 'src/common/guards/auth.guard';
import { PlanGuard, RequiresPlan } from 'src/common/plans/plan.guard';
import { UserRole } from 'src/modules/users/entities/user.entity';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PlanGuard)
@RequiresPlan('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('sales/excel')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Export sales to Excel (.xlsx)' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date (ISO string)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date (ISO string)' })
  async exportSales(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    const buffer = await this.reportsService.exportSalesToExcel(user.shopId, startDate, endDate);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="sales-${Date.now()}.xlsx"`,
      'Content-Length': buffer.length.toString(),
    });
    res.send(buffer);
  }

  @Get('inventory/excel')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Export inventory to Excel (.xlsx)' })
  async exportInventory(@CurrentUser() user: any, @Res() res: Response) {
    const buffer = await this.reportsService.exportInventoryToExcel(user.shopId);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="inventory-${Date.now()}.xlsx"`,
      'Content-Length': buffer.length.toString(),
    });
    res.send(buffer);
  }
}
