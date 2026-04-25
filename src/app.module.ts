import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Modules
import { AuthModule } from './modules/auth/auth.module';
import { ShopsModule } from './modules/shops/shops.module';
import { BrandsModule } from './modules/brands/brand.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { UnitsModule } from './modules/units/units.module';
import { ProductsModule } from './modules/products/products.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { PurchasesModule } from './modules/purchases/purchases.module';
import { SalesModule } from './modules/sales/sales.module';
// import { AnalyticsModule } from './modules/analytics/analytics.module';
// import { IncomeExpenseModule } from './modules/income-expense/income-expense.module';

// Entities
import { User } from './modules/users/entities/user.entity';
import { Shop } from './modules/shops/entities/shop.entity';
import { Brand } from './modules/brands/entities/brand.entity';
import { Category } from './modules/categories/entities/category.entity';
import { Unit } from './modules/units/entities/unit.entity';
import { Product } from './modules/products/entities/product.entity';
import { ProductPrice } from './modules/products/entities/product-price.entity';
import { InventoryItem } from './modules/inventory/entities/inventory-item.entity';
import { InventoryHistory } from './modules/inventory/entities/inventory-history.entity';
import { Supplier } from './modules/purchases/entities/supplier.entity';
import { Purchase } from './modules/purchases/entities/purchase.entity';
import { PurchaseItem } from './modules/purchases/entities/purchase-item.entity';
import { PurchaseReturn, PurchaseReturnItem } from './modules/purchases/entities/purchase-return.entity';
import { Customer } from './modules/sales/entities/customer.entity';
import { Sale, SaleItem } from './modules/sales/entities/sale.entity';
import { SaleReturn, SaleReturnItem } from './modules/sales/entities/sale-return.entity';
// import { IncomeExpense } from './modules/income-expense/entities/income-expense.entity';

import { appConfig, databaseConfig, jwtConfig } from './config/app.config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtAuthGuard, RolesGuard } from './common/guards/auth.guard';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { AppController } from './app.controller';

@Module({
  imports: [
    // Config
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig],
      envFilePath: ['.env', '.env.example'],
    }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('database.host'),
        port: config.get<number>('database.port'),
        username: config.get('database.username'),
        password: config.get('database.password'),
        database: config.get('database.database'),
        synchronize: config.get<boolean>('database.synchronize'),
        logging: config.get<boolean>('database.logging'),
        entities: [
          User,
          Shop,
          Brand,
          Category,
          Unit,
          Product,
          ProductPrice,
          InventoryItem,
          InventoryHistory,
          Supplier,
          Purchase,
          PurchaseItem,
          PurchaseReturn,
          PurchaseReturnItem,
          Customer,
          Sale,
          SaleItem,
          SaleReturn,
          SaleReturnItem,
          // IncomeExpense,
        ],
      }),
    }),
    // Feature modules
    AuthModule,
    ShopsModule,
    UnitsModule,
    BrandsModule,
    CategoriesModule,
    ProductsModule,
    InventoryModule,
    PurchasesModule,
    SalesModule,
    // IncomeExpenseModule,
    // AnalyticsModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
