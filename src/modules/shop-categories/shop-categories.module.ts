import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShopCategory } from './entities/shop-category.entity';
import { ShopCategoriesService } from './shop-categories.service';
import { ShopCategoriesController } from './shop-categories.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ShopCategory])],
  providers: [ShopCategoriesService],
  controllers: [ShopCategoriesController],
  exports: [ShopCategoriesService],
})
export class ShopCategoriesModule {}
