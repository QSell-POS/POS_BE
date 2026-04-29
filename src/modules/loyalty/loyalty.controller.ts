import { Controller, Get, Put, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard, CurrentUser, Roles } from 'src/common/guards/auth.guard';
import { UserRole } from 'src/modules/users/entities/user.entity';
import { LoyaltyService } from './loyalty.service';
import {
  UpdateLoyaltySettingsDto,
  EarnPointsDto,
  RedeemPointsDto,
  AdjustPointsDto,
  LoyaltyHistoryFilterDto,
} from './dto/loyalty.dto';

@ApiTags('Loyalty')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('loyalty')
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  @Get('settings')
  @ApiOperation({ summary: 'Get loyalty program settings for current shop' })
  getSettings(@CurrentUser() user: any) {
    return this.loyaltyService.getSettings(user.shopId);
  }

  @Put('settings')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update loyalty program settings' })
  updateSettings(@Body() dto: UpdateLoyaltySettingsDto, @CurrentUser() user: any) {
    return this.loyaltyService.updateSettings(dto, user.shopId);
  }

  @Get('customers/:id/balance')
  @ApiOperation({ summary: 'Get loyalty points balance for a customer' })
  getCustomerBalance(@Param('id') id: string, @CurrentUser() user: any) {
    return this.loyaltyService.getCustomerBalance(id, user.shopId);
  }

  @Get('customers/:id/history')
  @ApiOperation({ summary: 'Get loyalty transaction history for a customer' })
  getHistory(
    @Param('id') id: string,
    @Query() filters: LoyaltyHistoryFilterDto,
    @CurrentUser() user: any,
  ) {
    return this.loyaltyService.getHistory(id, user.shopId, filters);
  }

  @Post('customers/:id/earn')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Earn points for a customer based on sale total' })
  earnPoints(@Param('id') id: string, @Body() dto: EarnPointsDto, @CurrentUser() user: any) {
    return this.loyaltyService.earnPoints(id, dto.saleTotal, dto.saleId, user.shopId);
  }

  @Post('customers/:id/redeem')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Redeem loyalty points for a customer' })
  redeemPoints(@Param('id') id: string, @Body() dto: RedeemPointsDto, @CurrentUser() user: any) {
    return this.loyaltyService.redeemPoints(id, dto.points, dto.saleId, user.shopId);
  }

  @Post('customers/:id/adjust')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Manually adjust loyalty points for a customer (Admin only)' })
  adjustPoints(@Param('id') id: string, @Body() dto: AdjustPointsDto, @CurrentUser() user: any) {
    return this.loyaltyService.adjustPoints(id, dto, user.shopId, user.id);
  }
}
