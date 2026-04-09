import { Request } from "express";
import { Strategy } from "passport-jwt";
import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";

const cookieExtractor = (req: Request): string | null => {
  if (req && req.cookies) {
    return req.cookies["access_token"];
  }
  return null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: cookieExtractor,
      secretOrKey: process.env.SECRET_KEY || "supersecretkey",
    });
  }

  async validate(payload: any) {
    return { userId: payload.sub };
  }
}
