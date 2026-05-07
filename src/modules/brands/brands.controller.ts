import { BrandsService } from './brands.service';
import { BrandFilterDto, CreateBrandDto, UpdateBrandDto } from './dto/brand.dto';
import { UserRole } from '../users/entities/user.entity';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard, Permissions } from 'src/common/guards/auth.guard';
import { Permission } from 'src/common/permissions/permission.enum';
import { Get, Body, Post, Param, UseGuards, Controller, Delete, Query, Put } from '@nestjs/common';
import { UuidParamPipe } from 'src/common/validator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Brands')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('brands')
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Get()
  @Permissions(Permission.SETTINGS_VIEW)
  @ApiOperation({ summary: 'Get all brands' })
  findAll(@Query() filters: BrandFilterDto, @CurrentUser() user: any) {
    return this.brandsService.findAll(user.shopId, filters);
  }

  @Get(':id')
  @Permissions(Permission.SETTINGS_VIEW)
  @ApiOperation({ summary: 'Get brand by ID' })
  findOne(@Param('id', UuidParamPipe) id: string, @CurrentUser() user: any) {
    return this.brandsService.findOne(id, user.shopId);
  }

  @Post()
  @Permissions(Permission.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Create a new brand' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  create(@Body() dto: CreateBrandDto, @CurrentUser() user: any) {
    return this.brandsService.create(dto, user.shopId);
  }

  @Put(':id')
  @Permissions(Permission.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Update a brand' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  update(@Param('id', UuidParamPipe) id: string, @Body() dto: UpdateBrandDto, @CurrentUser() user: any) {
    return this.brandsService.update(id, dto, user.shopId);
  }

  @Delete(':id')
  @Permissions(Permission.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Delete a brand' })
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  remove(@Param('id', UuidParamPipe) id: string, @CurrentUser() user: any) {
    return this.brandsService.remove(id, user.shopId);
  }

  @Put(':id/restore')
  @Permissions(Permission.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Restore a soft-deleted brand' })
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  restore(@Param('id', UuidParamPipe) id: string, @CurrentUser() user: any) {
    return this.brandsService.restore(id, user.shopId);
  }
}
