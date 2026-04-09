import { Repository } from "typeorm";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Session } from "src/entities/session.entity";

@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(Session)
    private sessions: Repository<Session>,
  ) {}

  async create(userId: string, token: string) {
    return this.sessions.save({
      userId,
      token,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    });
  }

  async delete(token: string) {
    return this.sessions.delete({ token });
  }

  async validate(token: string) {
    return this.sessions.findOne({ where: { token } });
  }

  async deleteByUser(userId: string) {
    return this.sessions.delete({ userId });
  }
}
