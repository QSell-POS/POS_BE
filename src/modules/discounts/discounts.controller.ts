import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard, ShopId, Permissions } from 'src/common/guards/auth.guard';
import { Permission } from 'src/common/permissions/permission.enum';
import { UserRole } from 'src/modules/users/entities/user.entity';
import { UuidParamPipe } from 'src/common/validator';
import { DiscountsService } from './discounts.service';
import {
  CreateDiscountDto,
  DiscountFilterDto,
  UpdateDiscountDto,
  ValidateDiscountDto,
} from './dto/discount.dto';

@ApiBearerAuth()
@ApiTags('Discounts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('discounts')
export class DiscountsController {
  constructor(private readonly discountsService: DiscountsService) {}

  @Get()
  @Permissions(Permission.DISCOUNTS_VIEW)
  @ApiOperation({ summary: 'Get all discounts' })
  findAll(@ShopId() shopId: string, @Query() filters: DiscountFilterDto) {
    return this.discountsService.findAll(shopId, filters);
  }

  @Post('validate')
  @Permissions(Permission.DISCOUNTS_VIEW)
  @ApiOperation({ summary: 'Validate a coupon code' })
  validateCoupon(@Body() dto: ValidateDiscountDto, @ShopId() shopId: string) {
    return this.discountsService.validateCoupon(dto, shopId);
  }

  @Get(':id')
  @Permissions(Permission.DISCOUNTS_VIEW)
  @ApiOperation({ summary: 'Get discount by ID' })
  findOne(@Param('id', UuidParamPipe) id: string, @ShopId() shopId: string) {
    return this.discountsService.findOne(id, shopId);
  }

  @Post()
  @Permissions(Permission.DISCOUNTS_MANAGE)
  @ApiOperation({ summary: 'Create a new discount/coupon' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  create(@Body() dto: CreateDiscountDto, @ShopId() shopId: string) {
    return this.discountsService.create(dto, shopId);
  }

  @Put(':id')
  @Permissions(Permission.DISCOUNTS_MANAGE)
  @ApiOperation({ summary: 'Update a discount/coupon' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  update(
    @Param('id', UuidParamPipe) id: string,
    @Body() dto: UpdateDiscountDto,
    @ShopId() shopId: string,
  ) {
    return this.discountsService.update(id, dto, shopId);
  }

  @Delete(':id')
  @Permissions(Permission.DISCOUNTS_MANAGE)
  @ApiOperation({ summary: 'Delete a discount/coupon' })
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  remove(@Param('id', UuidParamPipe) id: string, @ShopId() shopId: string) {
    return this.discountsService.remove(id, shopId);
  }
}
