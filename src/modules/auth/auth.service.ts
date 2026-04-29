import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { ChangePasswordDto, LoginDto, RefreshTokenDto, RegisterDto } from './dto/auth.dto';
import { User, UserStatus } from 'src/modules/users/entities/user.entity';
import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailerService } from 'src/common/services/mailer.service';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 15;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private users: Repository<User>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mailerService: MailerService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.users.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered.');

    const user = this.users.create(dto);
    await this.users.save(user);

    const tokens = await this.generateTokens(user);
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return { user: this.sanitizeUser(user), ...tokens };
  }

  async login(dto: LoginDto) {
    const user = await this.users.findOne({ where: { email: dto.email } });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new HttpException(
        `Account is locked. Try again after ${user.lockedUntil.toISOString()}`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const isPasswordValid = await user.validatePassword(dto.password);
    if (!isPasswordValid) {
      // Increment login attempts
      const newAttempts = (user.loginAttempts || 0) + 1;
      const updateData: Partial<User> = { loginAttempts: newAttempts };
      if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
        const lockedUntil = new Date();
        lockedUntil.setMinutes(lockedUntil.getMinutes() + LOCK_DURATION_MINUTES);
        updateData.lockedUntil = lockedUntil;
      }
      await this.users.update(user.id, updateData);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is not active');
    }

    // Reset login attempts on success
    user.lastLoginAt = new Date();
    user.loginAttempts = 0;
    user.lockedUntil = null;
    await this.users.save(user);

    const tokens = await this.generateTokens(user);
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return { user: this.sanitizeUser(user), ...tokens };
  }

  async refreshToken(dto: RefreshTokenDto) {
    try {
      const payload = this.jwtService.verify(dto.refreshToken, {
        secret: this.configService.get('jwt.refreshSecret'),
      });

      const user = await this.users.findOne({ where: { id: payload.sub } });

      if (!user || !user.refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const isValid = await bcrypt.compare(dto.refreshToken, user.refreshToken);
      if (!isValid) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const tokens = await this.generateTokens(user);
      await this.saveRefreshToken(user.id, tokens.refreshToken);

      return tokens;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string) {
    await this.users.update(userId, { refreshToken: null });
    return { message: 'Logged out successfully' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const isValid = await user.validatePassword(dto.currentPassword);
    if (!isValid) throw new UnauthorizedException('Current password is incorrect');

    user.password = dto.newPassword;
    await this.users.save(user);

    return { message: 'Password changed successfully' };
  }

  async getProfile(userId: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return this.sanitizeUser(user);
  }

  async forgotPassword(email: string) {
    const user = await this.users.findOne({ where: { email } });
    // Always return success to avoid email enumeration
    if (!user) {
      return { message: 'If an account with that email exists, a reset link has been sent.' };
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expires = new Date();
    expires.setHours(expires.getHours() + 1);

    await this.users.update(user.id, {
      passwordResetToken: hashedToken,
      passwordResetExpires: expires,
    });

    const frontendUrl = this.configService.get('app.frontendUrl') || 'http://localhost:3000';
    await this.mailerService.sendPasswordReset(email, rawToken, frontendUrl);

    return {
      message: 'If an account with that email exists, a reset link has been sent.',
      token: rawToken, // returned for dev convenience; remove or hide in prod
    };
  }

  async resetPassword(token: string, newPassword: string) {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await this.users
      .createQueryBuilder('u')
      .addSelect('u.passwordResetToken')
      .addSelect('u.passwordResetExpires')
      .where('u.passwordResetToken = :hashedToken', { hashedToken })
      .getOne();

    if (!user) throw new NotFoundException('Invalid or expired reset token');
    if (!user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      throw new UnauthorizedException('Reset token has expired');
    }

    user.password = newPassword;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    user.loginAttempts = 0;
    user.lockedUntil = null;
    await this.users.save(user);

    return { message: 'Password has been reset successfully' };
  }

  async sendEmailVerification(userId: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.emailVerified) {
      return { message: 'Email is already verified' };
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expires = new Date();
    expires.setHours(expires.getHours() + 24);

    await this.users.update(user.id, {
      emailVerifyToken: hashedToken,
      emailVerifyExpires: expires,
    });

    const frontendUrl = this.configService.get('app.frontendUrl') || 'http://localhost:3000';
    await this.mailerService.sendEmailVerification(user.email, rawToken, frontendUrl);

    return { message: 'Verification email sent' };
  }

  async verifyEmail(token: string) {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await this.users
      .createQueryBuilder('u')
      .addSelect('u.emailVerifyToken')
      .addSelect('u.emailVerifyExpires')
      .where('u.emailVerifyToken = :hashedToken', { hashedToken })
      .getOne();

    if (!user) throw new NotFoundException('Invalid or expired verification token');
    if (!user.emailVerifyExpires || user.emailVerifyExpires < new Date()) {
      throw new UnauthorizedException('Verification token has expired');
    }

    await this.users.update(user.id, {
      emailVerified: true,
      emailVerifyToken: null,
      emailVerifyExpires: null,
    });

    return { message: 'Email verified successfully' };
  }

  private async generateTokens(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      shopId: user.shopId,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('jwt.secret'),
        expiresIn: this.configService.get('jwt.expiresIn'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('jwt.refreshSecret'),
        expiresIn: this.configService.get('jwt.refreshExpiresIn'),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async saveRefreshToken(userId: string, refreshToken: string) {
    const hashed = await bcrypt.hash(refreshToken, 10);
    await this.users.update(userId, { refreshToken: hashed });
  }

  private sanitizeUser(user: User) {
    const { password, refreshToken, ...rest } = user as any;
    return rest;
  }
}
