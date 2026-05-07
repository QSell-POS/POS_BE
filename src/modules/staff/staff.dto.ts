import {
  IsString, IsEmail, IsEnum, IsOptional, IsArray, IsNotEmpty,
  MinLength, IsBoolean, IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Permission } from 'src/common/permissions/permission.enum';
import { UserRole, UserStatus } from '../users/entities/user.entity';

const STAFF_ROLES = [UserRole.CASHIER, UserRole.MANAGER, UserRole.VIEWER];

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
    enum: STAFF_ROLES,
    example: UserRole.CASHIER,
    description: 'Role for the staff member — default permissions are assigned automatically.',
  })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiPropertyOptional({
    description: 'Shop to assign the staff to. Must belong to the caller\'s organization. Defaults to the caller\'s active shop.',
  })
  @IsOptional()
  @IsUUID()
  shopId?: string;
}

export class TransferStaffDto {
  @ApiProperty({ description: 'Target shop ID — must belong to the caller\'s organization' })
  @IsUUID()
  shopId: string;
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

export class StaffFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

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
