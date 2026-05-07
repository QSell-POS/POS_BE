import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto, UpdateExpenseDto, ExpenseFilterDto } from './dto/expense.dto';
import { JwtAuthGuard, CurrentUser, Roles, RolesGuard, Permissions } from '../../common/guards/auth.guard';
import { Permission } from 'src/common/permissions/permission.enum';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('Expenses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly service: ExpensesService) {}

  @Post()
  @Permissions(Permission.EXPENSES_CREATE)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Record an expense' })
  create(@Body() dto: CreateExpenseDto, @CurrentUser() user: any) {
    return this.service.create(dto, user.shopId, user.id);
  }

  @Get()
  @Permissions(Permission.EXPENSES_VIEW)
  @ApiOperation({ summary: 'List expenses with filters' })
  findAll(@Query() filters: ExpenseFilterDto, @CurrentUser() user: any) {
    return this.service.findAll(filters, user.shopId);
  }

  @Get('summary')
  @Permissions(Permission.EXPENSES_VIEW)
  @ApiOperation({ summary: 'Get expense summary grouped by type for a date range' })
  getSummary(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @CurrentUser() user: any,
  ) {
    return this.service.getSummaryByPeriod(user.shopId, startDate, endDate);
  }

  @Get(':id')
  @Permissions(Permission.EXPENSES_VIEW)
  @ApiOperation({ summary: 'Get expense by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.findOne(id, user.shopId);
  }

  @Put(':id')
  @Permissions(Permission.EXPENSES_CREATE)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update an expense' })
  update(@Param('id') id: string, @Body() dto: UpdateExpenseDto, @CurrentUser() user: any) {
    return this.service.update(id, dto, user.shopId);
  }

  @Delete(':id')
  @Permissions(Permission.EXPENSES_DELETE)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete an expense' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.remove(id, user.shopId);
  }
}
