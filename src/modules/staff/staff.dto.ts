import {
  IsString, IsEmail, IsEnum, IsOptional, IsArray, IsNotEmpty,
  MinLength, IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Permission, StaffPreset } from 'src/common/permissions/permission.enum';
import { UserStatus } from '../users/entities/user.entity';

export class CreateStaffDto {
  @ApiProperty({ example: 'John' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: 'john.doe@shop.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'StrongPass123!' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ example: '9800000000' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({
    enum: StaffPreset,
    example: StaffPreset.CASHIER,
    description: 'Preset role — auto-fills default permissions that you can then override.',
  })
  @IsEnum(StaffPreset)
  preset: StaffPreset;

  @ApiPropertyOptional({
    type: [String],
    enum: Permission,
    description: 'Override the preset permissions with a custom list. If omitted the preset defaults are used.',
  })
  @IsOptional()
  @IsArray()
  @IsEnum(Permission, { each: true })
  permissions?: Permission[];
}

export class UpdateStaffDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatar?: string;
}

export class SetPermissionsDto {
  @ApiProperty({
    type: [String],
    enum: Permission,
    description: 'Full replacement of the staff member permissions list.',
  })
  @IsArray()
  @IsEnum(Permission, { each: true })
  permissions: Permission[];
}

export class ApplyPresetDto {
  @ApiProperty({ enum: StaffPreset })
  @IsEnum(StaffPreset)
  preset: StaffPreset;
}

export class StaffFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: StaffPreset })
  @IsOptional()
  @IsEnum(StaffPreset)
  preset?: StaffPreset;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  limit?: number;
}
