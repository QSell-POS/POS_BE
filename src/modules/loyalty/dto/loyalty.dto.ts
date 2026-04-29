import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsPositive, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from 'src/common/dto/pagination.dto';

export class UpdateLoyaltySettingsDto {
  @ApiPropertyOptional({ description: 'Points earned per currency unit spent' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  pointsPerCurrencyUnit?: number;

  @ApiPropertyOptional({ description: 'Currency value per point when redeeming' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  currencyPerPoint?: number;

  @ApiPropertyOptional({ description: 'Minimum points required to redeem' })
  @IsOptional()
  @IsInt()
  @Min(1)
  minRedeemPoints?: number;

  @ApiPropertyOptional({ description: 'Days until points expire (null = never)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  pointsExpiryDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class EarnPointsDto {
  @ApiProperty({ description: 'Total sale amount to calculate points from' })
  @IsNumber()
  @IsPositive()
  saleTotal: number;

  @ApiProperty({ description: 'Sale reference ID' })
  @IsString()
  saleId: string;
}

export class RedeemPointsDto {
  @ApiProperty({ description: 'Number of points to redeem' })
  @IsInt()
  @Min(1)
  points: number;

  @ApiProperty({ description: 'Sale reference ID' })
  @IsString()
  saleId: string;
}

export class AdjustPointsDto {
  @ApiProperty({ description: 'Points to add (positive) or subtract (negative)' })
  @IsInt()
  points: number;

  @ApiProperty({ description: 'Reason for adjustment' })
  @IsString()
  description: string;
}

export class LoyaltyHistoryFilterDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => String)
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => String)
  endDate?: string;
}
