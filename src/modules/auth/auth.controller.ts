import type { Response } from "express";
import { AuthService } from "./auth.service";
import { SigninDto, SignupDto } from "./auth.dto";
import { Body, Post, Controller, Res } from "@nestjs/common";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("signup")
  async register(@Body() body: SignupDto) {
    return this.authService.signup(body);
  }

  @Post("signin")
  async login(
    @Body() body: SigninDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = await this.authService.signin(body);

    res.cookie("access_token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: 1000 * 60 * 60 * 24,
    });

    return { message: "Login success" };
  }
}
