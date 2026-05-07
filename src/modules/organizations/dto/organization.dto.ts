import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ShopPlan } from 'src/common/plans/plan.config';

export class UpdateOrganizationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;
}

export class UpgradePlanDto {
  @ApiProperty({ enum: ShopPlan })
  @IsEnum(ShopPlan)
  plan: ShopPlan;

  @ApiPropertyOptional({ description: 'Plan expiry date. Omit for no expiry.' })
  @IsOptional()
  @IsString()
  planExpiresAt?: string;
}
