import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination.dto';

export class CreatePurchaseItemDto {
  @ApiProperty()
  @IsUUID()
  productId: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  quantity: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  unitCost: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreatePurchaseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  expectedDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  shippingCost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  attachment?: string;

  @ApiProperty({ type: [CreatePurchaseItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseItemDto)
  items: CreatePurchaseItemDto[];
}

export class UpdatePurchaseDto extends PartialType(CreatePurchaseDto) {}

export class ReceivePurchaseDto {
  @ApiProperty({ description: 'Array of {productId, receivedQuantity}' })
  @IsArray()
  receivedItems: { purchaseItemId: string; receivedQuantity: number }[];

  @ApiPropertyOptional({ description: "Supplier's bill/invoice number" })
  @IsOptional()
  @IsString()
  supplierBillNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreatePurchaseReturnDto {
  @ApiProperty()
  @IsUUID()
  purchaseId: string;

  @ApiPropertyOptional({ description: 'cash | bank_transfer | supplier_credit | applied_to_due' })
  @IsOptional()
  @IsString()
  refundMethod?: string;

  @ApiPropertyOptional({ description: 'Actual cash received back from supplier. Defaults to totalAmount if no split provided.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  refundedAmount?: number;

  @ApiPropertyOptional({ description: 'Amount applied to reduce outstanding purchase due (no cash movement).' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  appliedToDueAmount?: number;

  @ApiPropertyOptional({ description: 'Supplier credit issued for future purchases from this supplier.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  supplierCreditIssued?: number;

  @ApiProperty({ description: 'Array of {productId, quantity, unitCost, reason}' })
  @IsArray()
  items: { productId: string; quantity: number; unitCost: number; reason?: string }[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateSupplierDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactPerson?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  taxNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateSupplierDto extends PartialType(CreateSupplierDto) {}

export class RecordPaymentDto {
  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  amount: number;
}

export class SupplierFilterDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}

export class PurchaseFilterDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endDate?: string;
}

export class PurchaseReturnFilterDto extends PaginationDto {}
