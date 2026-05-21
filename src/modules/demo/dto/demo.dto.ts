import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class BookDemoDto {
  @IsString() @IsNotEmpty() @MaxLength(100)
  name: string;

  @IsEmail()
  email: string;

  @IsOptional() @IsString() @MaxLength(20)
  phone?: string;

  @IsOptional() @IsString() @MaxLength(100)
  company?: string;

  @IsOptional() @IsString()
  message?: string;
}
