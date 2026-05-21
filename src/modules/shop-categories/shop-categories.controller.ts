import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, Roles, RolesGuard, Public } from 'src/common/guards/auth.guard';
import { UserRole } from '../users/entities/user.entity';
import { ShopCategoriesService, CreateShopCategoryDto } from './shop-categories.service';

@ApiTags('Shop Categories')
@Controller('shop-categories')
export class ShopCategoriesController {
  constructor(private readonly service: ShopCategoriesService) {}

  @Public()
  @Get()
  findAll(@Query('includeInactive') includeInactive: string) {
    return this.service.findAll(includeInactive === 'true');
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Post()
  create(@Body() dto: CreateShopCategoryDto) {
    return this.service.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateShopCategoryDto> & { isActive?: boolean }) {
    return this.service.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
