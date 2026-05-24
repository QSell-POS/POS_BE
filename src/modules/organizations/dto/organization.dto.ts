import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

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
  @ApiProperty({ description: 'Plan key (plans.key), e.g. free / pro / enterprise or any custom plan' })
  @IsString()
  @IsNotEmpty()
  plan: string;

  @ApiPropertyOptional({ description: 'Plan expiry date. Omit for no expiry.' })
  @IsOptional()
  @IsString()
  planExpiresAt?: string;
}
