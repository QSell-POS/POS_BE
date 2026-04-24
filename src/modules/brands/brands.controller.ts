import { BrandsService } from './brands.service';
import { CreateBrandDto, UpdateBrandDto } from './dto/brand.dto';
import { UserRole } from '../users/entities/user.entity';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from 'src/common/guards/auth.guard';
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
  @ApiOperation({ summary: 'Get all brands' })
  findAll(@Query('search') search: string, @CurrentUser() user: any) {
    return this.brandsService.findAll(user.shopId, search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get brand by ID' })
  findOne(@Param('id', UuidParamPipe) id: string, @CurrentUser() user: any) {
    return this.brandsService.findOne(id, user.shopId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new brand' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  create(@Body() dto: CreateBrandDto, @CurrentUser() user: any) {
    return this.brandsService.create(dto, user.shopId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a brand' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  update(@Param('id', UuidParamPipe) id: string, @Body() dto: UpdateBrandDto, @CurrentUser() user: any) {
    return this.brandsService.update(id, dto, user.shopId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a brand' })
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  remove(@Param('id', UuidParamPipe) id: string, @CurrentUser() user: any) {
    return this.brandsService.remove(id, user.shopId);
  }
}
