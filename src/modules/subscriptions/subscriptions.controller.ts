import {
  Controller, Post, Get, Body, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/common/guards/auth.guard';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from 'src/common/guards/auth.guard';
import { UserRole } from 'src/modules/users/entities/user.entity';
import { SubscriptionsService } from './subscriptions.service';
import { InitiateSubscriptionDto } from './subscriptions.dto';

@ApiTags('Subscriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post('initiate')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Initiate an eSewa payment to upgrade the organization plan' })
  initiatePayment(@Body() dto: InitiateSubscriptionDto, @CurrentUser() user: any) {
    return this.subscriptionsService.initiatePayment(dto, user.organizationId);
  }

  @Get('plan')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get current active plan for the organization' })
  getCurrentPlan(@CurrentUser() user: any) {
    return this.subscriptionsService.getCurrentPlan(user.organizationId);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get subscription payment history for the organization' })
  getHistory(@CurrentUser() user: any) {
    return this.subscriptionsService.getHistory(user.organizationId);
  }

  @Public()
  @Get('esewa/success')
  @ApiOperation({ summary: 'eSewa payment success callback — verifies and activates the plan' })
  @ApiQuery({ name: 'data', description: 'Base64-encoded JSON response from eSewa' })
  esewaSuccess(@Query('data') data: string) {
    return this.subscriptionsService.handleSuccess(data);
  }

  @Public()
  @Get('esewa/failure')
  @ApiOperation({ summary: 'eSewa payment failure callback' })
  @ApiQuery({ name: 'data', required: false })
  esewaFailure(@Query('data') data: string) {
    return this.subscriptionsService.handleFailure(data ?? '');
  }
}
