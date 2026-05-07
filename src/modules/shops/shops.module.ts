import { Module } from '@nestjs/common';
import { ShopsService } from './shops.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ShopsController } from './shops.controller';
import { Shop } from './entities/shop.entity';
import { User } from '../users/entities/user.entity';
import { PlanModule } from 'src/common/plans/plan.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Shop, User]),
    PlanModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('jwt.secret'),
        signOptions: { expiresIn: config.get('jwt.expiresIn') },
      }),
    }),
  ],
  providers: [ShopsService],
  controllers: [ShopsController],
  exports: [ShopsService],
})
export class ShopsModule {}
