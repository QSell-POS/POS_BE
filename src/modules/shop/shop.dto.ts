import { IsNotEmpty, MinLength } from "class-validator";

export class CreateShopDto {
  @IsNotEmpty()
  @MinLength(4)
  name: string;
}

export class UpdateShopDto {
  @IsNotEmpty()
  @MinLength(4)
  name: string;
}
