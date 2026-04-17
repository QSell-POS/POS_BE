import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuthModule } from "./modules/auth/auth.module";
import { ShopModule } from "./modules/shop/shop.module";
import { ProductModule } from "./modules/product/product.module";
import { PurchaseModule } from "./modules/purchase/purchase.module";
import { BrandModule } from "./modules/brand/brand.module";
import { CategoryModule } from "./modules/category/category.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        return {
          type: "postgres",
          host: "localhost",
          port: 5432,
          username: "pos",
          password: "pos",
          database: "posdb",
          autoLoadEntities: true,
          synchronize: true,
        };
      },
    }),
    AuthModule,
    ShopModule,
    BrandModule,
    ProductModule,
    CategoryModule,
    PurchaseModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
