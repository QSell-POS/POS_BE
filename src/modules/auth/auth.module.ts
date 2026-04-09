import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthService } from "./auth.service";
import { User } from "src/entities/user.entity";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller";
import { JwtStrategy } from "src/guards/auth.guard";
import { SessionModule } from "../session/session.module";

@Module({
  imports: [
    SessionModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.SECRET_KEY || "supersecretkey",
      signOptions: { expiresIn: "1d" },
    }),
    TypeOrmModule.forFeature([User]),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
