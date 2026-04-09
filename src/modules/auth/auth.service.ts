import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { Repository } from "typeorm";
import { JwtService } from "@nestjs/jwt";
import { User } from "src/entities/user.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { SigninDto, SignupDto } from "./auth.dto";
import { SessionService } from "../session/session.service";

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private users: Repository<User>,
    private jwtService: JwtService,
    private sessionService: SessionService,
  ) {}

  async signup(data: SignupDto) {
    const existing = await this.users.findOne({ where: { email: data.email } });
    if (existing) throw new BadRequestException("Email already exists");
    const hashed = await bcrypt.hash(data.password, 10);

    const user = this.users.create({
      email: data.email,
      name: data.name,
      password: hashed,
    });

    await this.users.save(user);
    return { message: "User created" };
  }

  async signin(data: SigninDto) {
    const user = await this.users.findOne({ where: { email: data.email } });
    if (!user) throw new UnauthorizedException("Invalid credentials");

    const isMatch = await bcrypt.compare(data.password, user.password);
    if (!isMatch) throw new UnauthorizedException("Invalid credentials");

    const token = this.jwtService.sign({ sub: user.id });
    await this.sessionService.deleteByUser(user.id);
    await this.sessionService.create(user.id, token);
    return token;
  }
}
