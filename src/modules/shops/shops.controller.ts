import { Get, Body, Post, Param, UseGuards, Controller, Put, BadRequestException, Query } from '@nestjs/common';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from 'src/common/guards/auth.guard';
import { UserRole } from '../users/entities/user.entity';
import { CreateShopDto, ShopFilterDto, UpdateShopDto } from './dto/shop.dto';
import { ShopsService } from './shops.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Shops')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('shops')
export class ShopsController {
  constructor(private readonly shopsService: ShopsService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all shops (super admin only)' })
  findAll(@Query() filters: ShopFilterDto) {
    return this.shopsService.findAll(filters);
  }

  @Get('me')
  @ApiOperation({ summary: "Get current user's shop" })
  getMyShop(@CurrentUser() user: any) {
    if (!user.shopId) {
      throw new BadRequestException("You don't have a shop yet");
    }
    return this.shopsService.getMyShop(user.shopId);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get a shop by ID (super admin only)' })
  async findOne(@Param('id') id: string) {
    return {
      data: await this.shopsService.findOne(id),
    };
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new shop (super admin only)' })
  create(@Body() dto: CreateShopDto, @CurrentUser() user: any) {
    return this.shopsService.create(dto, user.id);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a shop (admin or super admin only)' })
  update(@Param('id') id: string, @Body() dto: UpdateShopDto) {
    return this.shopsService.update(id, dto);
  }
}
