import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ExpenseTypesService } from './expense-types.service';
import { CreateExpenseTypeDto, UpdateExpenseTypeDto, ExpenseTypeFilterDto } from './dto/expense-type.dto';
import { JwtAuthGuard, CurrentUser, Roles, RolesGuard, Permissions } from '../../common/guards/auth.guard';
import { Permission } from 'src/common/permissions/permission.enum';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('Expense Types')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('expense-types')
export class ExpenseTypesController {
  constructor(private readonly service: ExpenseTypesService) {}

  @Post()
  @Permissions(Permission.SETTINGS_MANAGE)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new expense type' })
  create(@Body() dto: CreateExpenseTypeDto, @CurrentUser() user: any) {
    return this.service.create(dto, user.shopId);
  }

  @Get()
  @Permissions(Permission.SETTINGS_VIEW)
  @ApiOperation({ summary: 'List expense types' })
  findAll(@Query() filters: ExpenseTypeFilterDto, @CurrentUser() user: any) {
    return this.service.findAll(filters, user.shopId);
  }

  @Get(':id')
  @Permissions(Permission.SETTINGS_VIEW)
  @ApiOperation({ summary: 'Get expense type by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.findOne(id, user.shopId);
  }

  @Put(':id')
  @Permissions(Permission.SETTINGS_MANAGE)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update an expense type' })
  update(@Param('id') id: string, @Body() dto: UpdateExpenseTypeDto, @CurrentUser() user: any) {
    return this.service.update(id, dto, user.shopId);
  }

  @Delete(':id')
  @Permissions(Permission.SETTINGS_MANAGE)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete an expense type' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.remove(id, user.shopId);
  }
}
