import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { IdempotencyMiddleware } from './common/middleware/idempotency.middleware';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

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
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { CommonModule } from './common/common.module';
import { UsersModule } from './modules/users/users.module';
import { ShiftsModule } from './modules/shifts/shifts.module';
import { DiscountsModule } from './modules/discounts/discounts.module';
import { TaxModule } from './modules/tax/tax.module';
import { StockTransferModule } from './modules/stock-transfer/stock-transfer.module';
import { LoyaltyModule } from './modules/loyalty/loyalty.module';
import { UploadModule } from './modules/upload/upload.module';
import { AuditModule } from './modules/audit/audit.module';
import { HealthModule } from './modules/health/health.module';
import { ReportsModule } from './modules/reports/reports.module';

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
import { Expense } from './modules/expenses/entities/expense.entity';
import { ExpenseType } from './modules/expenses/entities/expense-type.entity';
import { Shift } from './modules/shifts/entities/shift.entity';
import { Discount } from './modules/discounts/entities/discount.entity';
import { TaxRule } from './modules/tax/entities/tax-rule.entity';
import { StockTransfer, StockTransferItem } from './modules/stock-transfer/entities/stock-transfer.entity';
import { LoyaltyTransaction, LoyaltySettings } from './modules/loyalty/entities/loyalty.entity';
import { AuditLog } from './modules/audit/entities/audit-log.entity';

import { appConfig, databaseConfig, jwtConfig, mailerConfig, uploadConfig } from './config/app.config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtAuthGuard, RolesGuard } from './common/guards/auth.guard';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { AppController } from './app.controller';
import { SupplierLedger } from './modules/purchases/entities/supplier-ledger.entity';
import { CustomerLedger } from './modules/sales/entities/customer-ledger.entity';
import { CustomerPayment } from './modules/sales/entities/customer-payment.entity';
import { SupplierPayment } from './modules/purchases/entities/supplier-payment.entity';

@Module({
  imports: [
    // Config
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig, mailerConfig, uploadConfig],
      envFilePath: ['.env', '.env.example'],
    }),

    // Rate limiting
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),

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
        extra: {
          options: `-c timezone=${process.env.TZ || 'Asia/Kathmandu'}`,
        },
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
          SupplierLedger,
          SupplierPayment,
          Purchase,
          PurchaseItem,
          PurchaseReturn,
          PurchaseReturnItem,
          Customer,
          CustomerLedger,
          CustomerPayment,
          Sale,
          SaleItem,
          SaleReturn,
          SaleReturnItem,
          Expense,
          ExpenseType,
          Shift,
          Discount,
          TaxRule,
          StockTransfer,
          StockTransferItem,
          LoyaltyTransaction,
          LoyaltySettings,
          AuditLog,
        ],
      }),
    }),
    // Feature modules
    CommonModule,
    AuthModule,
    UsersModule,
    ShopsModule,
    UnitsModule,
    BrandsModule,
    CategoriesModule,
    ProductsModule,
    InventoryModule,
    PurchasesModule,
    SalesModule,
    ExpensesModule,
    AnalyticsModule,
    ShiftsModule,
    DiscountsModule,
    TaxModule,
    StockTransferModule,
    LoyaltyModule,
    UploadModule,
    AuditModule,
    HealthModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(IdempotencyMiddleware).forRoutes({ path: '*', method: RequestMethod.POST });
  }
}
