import { Module } from "@nestjs/common";
import { ShopService } from "./shop.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Shop } from "src/entities/shop.entity";
import { JwtStrategy } from "src/guards/auth.guard";
import { ShopController } from "./shop.controller";

@Module({
  imports: [TypeOrmModule.forFeature([Shop])],
  providers: [ShopService, JwtStrategy],
  controllers: [ShopController],
})
export class ShopModule {}
