import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ShopPlan } from 'src/common/plans/plan.config';
import { SubscriptionDuration } from './entities/subscription.entity';

const PAID_PLANS = [ShopPlan.PRO, ShopPlan.ENTERPRISE];

export class InitiateSubscriptionDto {
  @ApiProperty({ enum: PAID_PLANS, example: ShopPlan.PRO })
  @IsEnum(ShopPlan)
  @IsNotEmpty()
  plan: ShopPlan;

  @ApiProperty({ enum: SubscriptionDuration, example: SubscriptionDuration.MONTHLY })
  @IsEnum(SubscriptionDuration)
  @IsNotEmpty()
  duration: SubscriptionDuration;
}
