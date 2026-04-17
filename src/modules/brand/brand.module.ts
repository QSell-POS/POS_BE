import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtStrategy } from "src/guards/auth.guard";
import { Brand } from "src/entities/brand.entity";
import { BrandService } from "./brand.service";
import { BrandController } from "./brand.controller";
import { Shop } from "src/entities/shop.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Brand, Shop])],
  providers: [BrandService, JwtStrategy],
  controllers: [BrandController],
})
export class BrandModule {}
