import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Session } from "src/entities/session.entity";
import { SessionService } from "./session.service";

@Module({
  imports: [TypeOrmModule.forFeature([Session])],
  providers: [SessionService],
  exports: [SessionService, TypeOrmModule.forFeature([Session])],
})
export class SessionModule {}
