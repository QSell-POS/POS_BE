import { IsNotEmpty, IsUUID, MinLength } from "class-validator";

export class BrandDto {
  @IsNotEmpty()
  @MinLength(3)
  name: string;

  @IsUUID()
  @IsNotEmpty()
  shopId: string;
}

export class BrandUpdateDto {
  @IsNotEmpty()
  @MinLength(3)
  name: string;
}
