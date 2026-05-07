import { Get, Body, Post, Param, UseGuards, Controller, Put, BadRequestException, Query } from '@nestjs/common';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from 'src/common/guards/auth.guard';
import { UserRole } from '../users/entities/user.entity';
import { CreateShopDto, ShopFilterDto, UpdateShopDto } from './dto/shop.dto';
import { ShopsService } from './shops.service';
import { PlanService } from 'src/common/plans/plan.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Shops')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('shops')
export class ShopsController {
  constructor(
    private readonly shopsService: ShopsService,
    private readonly planService: PlanService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  @Get('my-plan')
  @ApiOperation({ summary: 'Get current shop plan and available features' })
  getMyPlan(@CurrentUser() user: any) {
    return this.planService.getPlanInfo(user.shopId);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all shops (super admin only)' })
  findAll(@Query() filters: ShopFilterDto) {
    return this.shopsService.findAll(filters);
  }

  @Get('mine')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: "List all shops under the caller's organization" })
  listMyShops(@CurrentUser() user: any) {
    return this.shopsService.findMyOrgShops(user.organizationId);
  }

  @Get('me')
  @ApiOperation({ summary: "Get current user's active shop" })
  getMyShop(@CurrentUser() user: any) {
    if (!user.shopId) {
      throw new BadRequestException("You don't have a shop yet");
    }
    return this.shopsService.getMyShop(user.shopId);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get a shop by ID (super admin: any shop, admin: own shop only)' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return {
      data: await this.shopsService.findOne(id, user.id, user.role === UserRole.SUPER_ADMIN),
    };
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: "Create a new shop under the caller's organization" })
  async create(@Body() dto: CreateShopDto, @CurrentUser() user: any) {
    if (!user.organizationId) {
      throw new BadRequestException('You must belong to an organization to create a shop');
    }
    const shop = await this.shopsService.createForOrg(dto, user.id, user.organizationId);
    return { data: shop, message: 'Shop created successfully' };
  }

  @Post(':id/switch')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: "Switch the caller's active shop and return a new access token" })
  async switchShop(@Param('id') id: string, @CurrentUser() user: any) {
    const result = await this.shopsService.switchShop(user.id, user.organizationId, id);
    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        shopId: result.data.id,
        organizationId: user.organizationId,
      },
      {
        secret: this.configService.get('jwt.secret'),
        expiresIn: this.configService.get('jwt.expiresIn'),
      },
    );
    return { ...result, accessToken };
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a shop (admin updates own shop, super admin updates any)' })
  update(@Param('id') id: string, @Body() dto: UpdateShopDto, @CurrentUser() user: any) {
    const isSuperAdmin = user.role === UserRole.SUPER_ADMIN;
    return this.shopsService.update(id, dto, user.id, isSuperAdmin);
  }
}
