import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

export class ProductDto {
  @IsUUID()
  @IsNotEmpty()
  shopId: string;

  @IsUUID()
  @IsNotEmpty()
  brandId: string;

  @IsUUID()
  @IsNotEmpty()
  categoryId: string;

  @IsNotEmpty()
  @MinLength(3)
  name: string;

  @IsOptional()
  @MaxLength(255)
  description: string;

  @IsNotEmpty()
  sku: string;

  @IsOptional()
  @IsString()
  barcode: string;

  @IsOptional()
  @IsString()
  unit: string;

  @IsNumber()
  lowStockAlert: number;

  @IsOptional()
  isActive: boolean;
}
