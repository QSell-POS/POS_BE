import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { InventoryMovementType } from '../entities/inventory-history.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AdjustStockDto {
  @ApiProperty()
  @IsUUID()
  productId: string;

  @ApiProperty()
  @IsUUID()
  variantId: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  quantity: number;

  @ApiProperty({ enum: InventoryMovementType })
  @IsEnum(InventoryMovementType)
  movementType: InventoryMovementType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  unitCost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export interface StockAdjustmentDto {
  productId: string;
  variantId: string;
  quantity: number;
  movementType: InventoryMovementType;
  notes?: string;
  referenceId?: string;
  referenceType?: string;
  unitCost?: number;
  performedBy?: string;
}
