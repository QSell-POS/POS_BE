import { IsNotEmpty, IsUUID, MinLength } from "class-validator";

export class CategoryDto {
  @IsNotEmpty()
  @MinLength(3)
  name: string;

  @IsUUID()
  @IsNotEmpty()
  shopId: string;
}

export class CategoryUpdateDto {
  @IsNotEmpty()
  @MinLength(3)
  name: string;
}
