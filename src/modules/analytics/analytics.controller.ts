import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard, CurrentUser, RolesGuard, Permissions } from '../../common/guards/auth.guard';
import { Permission } from 'src/common/permissions/permission.enum';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Permissions(Permission.ANALYTICS_VIEW)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Dashboard overview stats (today, this month, growth)' })
  getDashboard(@CurrentUser() user: any) {
    return this.analyticsService.getDashboardStats(user.shopId);
  }

  @Get('sales-chart')
  @ApiOperation({ summary: 'Revenue & order count: weekly (7 days) or monthly (12 months) ending now' })
  @ApiQuery({ name: 'period', enum: ['weekly', 'monthly'], required: false })
  getSalesChart(@Query('period') period: 'weekly' | 'monthly', @CurrentUser() user: any) {
    return this.analyticsService.getSalesChart(user.shopId, period || 'weekly');
  }

  @Get('price-fluctuation/:productId')
  @ApiOperation({ summary: 'Price change history chart for a product' })
  getPriceFluctuation(@Param('productId') productId: string, @CurrentUser() user: any) {
    return this.analyticsService.getPriceFluctuationChart(productId, user.shopId);
  }

  @Get('most-selling')
  @ApiOperation({ summary: 'Most selling / MVP products by quantity and revenue' })
  getMostSelling(
    @Query('limit') limit: number,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @CurrentUser() user: any,
  ) {
    return this.analyticsService.getMostSellingProducts(user.shopId, limit || 10, startDate, endDate);
  }

  @Get('slow-moving')
  @ApiOperation({ summary: 'Slow-moving / stale inventory products' })
  getSlowMoving(@Query('days') days: number, @Query('limit') limit: number, @CurrentUser() user: any) {
    return this.analyticsService.getSlowMovingProducts(user.shopId, days || 30, limit || 10);
  }

  @Get('sales-prediction')
  @ApiOperation({ summary: 'AI-style sales prediction using linear regression + seasonality' })
  @ApiQuery({ name: 'futureDays', required: false, example: 7 })
  getSalesPrediction(@Query('futureDays') futureDays: number, @CurrentUser() user: any) {
    return this.analyticsService.getSalesPrediction(user.shopId, futureDays || 7);
  }

  @Get('profit-loss')
  @ApiOperation({ summary: 'Full Profit & Loss report for a date range' })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  getProfitLoss(@Query('startDate') startDate: string, @Query('endDate') endDate: string, @CurrentUser() user: any) {
    return this.analyticsService.getProfitLossReport(user.shopId, startDate, endDate);
  }

  @Get('category-performance')
  @ApiOperation({ summary: 'Revenue, quantity & profit by category' })
  getCategoryPerformance(@Query('startDate') startDate: string, @Query('endDate') endDate: string, @CurrentUser() user: any) {
    return this.analyticsService.getCategoryPerformance(user.shopId, startDate, endDate);
  }

  @Get('stock-valuation')
  @ApiOperation({ summary: 'Current stock value by product (weighted average cost)' })
  getStockValuation(@CurrentUser() user: any) {
    return this.analyticsService.getStockValuation(user.shopId);
  }

  @Get('top-customers')
  @ApiOperation({ summary: 'Top customers by total spend' })
  getTopCustomers(
    @Query('limit') limit: number,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @CurrentUser() user: any,
  ) {
    return this.analyticsService.getTopCustomers(user.shopId, limit || 10, startDate, endDate);
  }
}
