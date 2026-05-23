import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray, IsBoolean, IsInt, IsNotEmpty, IsNumber, IsObject,
  IsOptional, IsString, Matches, Min, ValidateNested,
} from 'class-validator';

export class PlanLimitsDto {
  @ApiProperty({ description: '-1 = unlimited' })
  @IsInt()
  @Min(-1)
  maxShops: number;

  @ApiProperty({ description: '-1 = unlimited' })
  @IsInt()
  @Min(-1)
  maxUsers: number;

  @ApiProperty({ description: '-1 = unlimited' })
  @IsInt()
  @Min(-1)
  maxProducts: number;

  @ApiProperty({ description: '-1 = unlimited' })
  @IsInt()
  @Min(-1)
  maxTransactionsPerMonth: number;
}

export class PlanFeatureFlagsDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() reports?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() bulkImport?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() loyalty?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() stockTransfer?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() apiAccess?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() invoiceGen?: boolean;
}

export class CreatePlanDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Unique slug, e.g. free / pro / enterprise / custom' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, { message: 'key must be lowercase alphanumeric with dashes' })
  key: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: '0 = free tier' })
  @IsNumber()
  @Min(0)
  monthlyPrice: number;

  @ApiPropertyOptional({ description: 'null = not offered annually' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  annualPrice?: number | null;

  @ApiPropertyOptional({ description: '0 = no trial' })
  @IsOptional()
  @IsInt()
  @Min(0)
  trialDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPopular?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiProperty({ type: PlanLimitsDto })
  @IsObject()
  @ValidateNested()
  @Type(() => PlanLimitsDto)
  limits: PlanLimitsDto;

  @ApiPropertyOptional({ type: [String], description: 'Display strings for the pricing UI' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @ApiPropertyOptional({ type: PlanFeatureFlagsDto, description: 'Typed flags used for enforcement' })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PlanFeatureFlagsDto)
  featureFlags?: PlanFeatureFlagsDto;
}

export class UpdatePlanDto extends PartialType(CreatePlanDto) {}
