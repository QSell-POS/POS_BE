import { UuidParamPipe } from 'src/common/validator';
import { CategoriesService } from './categories.service';
import { UserRole } from '../users/entities/user.entity';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard, Permissions } from 'src/common/guards/auth.guard';
import { Permission } from 'src/common/permissions/permission.enum';
import { Get, Body, Post, Param, UseGuards, Controller, Delete, Query, Put } from '@nestjs/common';
import { CategoryFilterDto, CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiBearerAuth()
@ApiTags('Categories')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoryService: CategoriesService) {}

  @Get()
  @Permissions(Permission.SETTINGS_VIEW)
  @ApiOperation({ summary: 'Get category list' })
  getFlat(@Query() filters: CategoryFilterDto, @CurrentUser() user: any) {
    return this.categoryService.findFlat(user.shopId, filters);
  }

  @Post()
  @Permissions(Permission.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Create a new category' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  create(@Body() dto: CreateCategoryDto, @CurrentUser() user: any) {
    return this.categoryService.create(dto, user.shopId);
  }

  @Get('tree')
  @Permissions(Permission.SETTINGS_VIEW)
  @ApiOperation({ summary: 'Get category tree' })
  getTree(@CurrentUser() user: any) {
    return this.categoryService.findAll(user.shopId);
  }

  @Get(':id')
  @Permissions(Permission.SETTINGS_VIEW)
  @ApiOperation({ summary: 'Get category by ID' })
  findOne(@Param('id', UuidParamPipe) id: string, @CurrentUser() user: any) {
    return this.categoryService.findOne(id, user.shopId);
  }

  @Put(':id')
  @Permissions(Permission.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Update a category' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  update(@Param('id', UuidParamPipe) id: string, @Body() dto: UpdateCategoryDto, @CurrentUser() user: any) {
    return this.categoryService.update(id, dto, user.shopId);
  }

  @Delete(':id')
  @Permissions(Permission.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Delete a category' })
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  remove(@Param('id', UuidParamPipe) id: string, @CurrentUser() user: any) {
    return this.categoryService.remove(id, user.shopId);
  }

  @Put(':id/restore')
  @Permissions(Permission.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Restore a soft-deleted category' })
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  restore(@Param('id', UuidParamPipe) id: string, @CurrentUser() user: any) {
    return this.categoryService.restore(id, user.shopId);
  }
}
