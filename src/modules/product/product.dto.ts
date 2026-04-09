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

  @IsNotEmpty()
  @IsNumber()
  sellingPrice: number;

  @IsNotEmpty()
  @IsNumber()
  costPrice: number;

  @IsNumber()
  lowStockAlert: number;

  @IsOptional()
  isActive: boolean;
}
