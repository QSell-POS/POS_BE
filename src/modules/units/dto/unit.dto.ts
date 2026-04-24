import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateUnitDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  symbol: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
export class UpdateUnitDto extends PartialType(CreateUnitDto) {}
