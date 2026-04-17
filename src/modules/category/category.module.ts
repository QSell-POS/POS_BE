import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtStrategy } from "src/guards/auth.guard";
import { CategoryService } from "./category.service";
import { Category } from "src/entities/category.entity";
import { CategoryController } from "./category.controller";

@Module({
  imports: [TypeOrmModule.forFeature([Category])],
  providers: [CategoryService, JwtStrategy],
  controllers: [CategoryController],
})
export class CategoryModule {}
