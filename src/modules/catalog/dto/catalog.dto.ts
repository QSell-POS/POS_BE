import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { CatalogProductStatus } from '../entities/catalog-product.entity';

export class CreateCatalogProductDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shopType?: string;
}

export class UpdateCatalogProductDto extends PartialType(CreateCatalogProductDto) {}

export class SuggestCatalogProductDto extends CreateCatalogProductDto {}

export class ReviewCatalogProductDto {
  @ApiProperty({ enum: [CatalogProductStatus.APPROVED, CatalogProductStatus.REJECTED] })
  @IsEnum([CatalogProductStatus.APPROVED, CatalogProductStatus.REJECTED])
  status: CatalogProductStatus.APPROVED | CatalogProductStatus.REJECTED;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}

export class ImportCatalogProductDto {
  @ApiProperty()
  @IsUUID()
  catalogProductId: string;
}

export class LinkSuggestionDto {
  @ApiProperty({ description: 'Existing approved catalog product to link this suggestion to' })
  @IsUUID()
  catalogProductId: string;
}

export class LinkProductToCatalogDto {
  @ApiProperty()
  @IsUUID()
  productId: string;

  @ApiProperty()
  @IsUUID()
  catalogProductId: string;
}

export class BulkImportDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID(undefined, { each: true })
  catalogProductIds: string[];
}

export class CatalogFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: CatalogProductStatus })
  @IsOptional()
  status?: CatalogProductStatus;

  @ApiPropertyOptional()
  @IsOptional()
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  limit?: number;
}
