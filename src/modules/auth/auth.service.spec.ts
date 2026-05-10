import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException, UnauthorizedException, HttpException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { AuthService } from './auth.service';
import { User, UserRole, UserStatus } from '../users/entities/user.entity';
import { Shop } from '../shops/entities/shop.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { MailerService } from 'src/common/services/mailer.service';

const mockUser = (overrides = {}): Partial<User> => ({
  id: 'user-uuid',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  role: UserRole.ADMIN,
  status: UserStatus.ACTIVE,
  loginAttempts: 0,
  lockedUntil: null,
  organizationId: 'org-uuid',
  shopId: 'shop-uuid',
  refreshToken: null,
  validatePassword: jest.fn().mockResolvedValue(true),
  ...overrides,
});

const makeRepo = () => ({
  findOne: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  create: jest.fn((data) => data),
  createQueryBuilder: jest.fn(() => ({
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
  })),
});

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: ReturnType<typeof makeRepo>;
  let shopRepo: ReturnType<typeof makeRepo>;
  let orgRepo: ReturnType<typeof makeRepo>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;
  let mailerService: jest.Mocked<MailerService>;
  let dataSource: jest.Mocked<any>;

  beforeEach(async () => {
    userRepo = makeRepo();
    shopRepo = makeRepo();
    orgRepo = makeRepo();

    const txManager = {
      create: jest.fn((Entity, data) => data),
      save: jest.fn().mockImplementation((_, data) => Promise.resolve({ ...data, id: 'new-id' })),
      findOne: jest.fn(),
    };
    dataSource = {
      transaction: jest.fn().mockImplementation((cb) => cb(txManager)),
    };

    jwtService = {
      signAsync: jest.fn().mockResolvedValue('signed-token'),
      verify: jest.fn(),
    } as any;

    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        const cfg: Record<string, any> = {
          'jwt.secret': 'secret',
          'jwt.expiresIn': '7d',
          'jwt.refreshSecret': 'refresh-secret',
          'jwt.refreshExpiresIn': '30d',
          'auth.maxLoginAttempts': 5,
          'auth.lockDurationMinutes': 15,
          'auth.passwordResetExpiryHours': 1,
          'auth.emailVerifyExpiryHours': 24,
          'app.frontendUrl': 'http://localhost:3000',
        };
        return cfg[key];
      }),
    } as any;

    mailerService = {
      sendPasswordReset: jest.fn().mockResolvedValue(undefined),
      sendEmailVerification: jest.fn().mockResolvedValue(undefined),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Shop), useValue: shopRepo },
        { provide: getRepositoryToken(Organization), useValue: orgRepo },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        { provide: MailerService, useValue: mailerService },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  // ── register ─────────────────────────────────────────────────────────────

  describe('register', () => {
    it('creates user, org, shop atomically and returns tokens', async () => {
      userRepo.findOne.mockResolvedValue(null);
      shopRepo.findOne.mockResolvedValue(null);
      userRepo.update.mockResolvedValue({});

      const result = await service.register({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'Password1!',
      } as any);

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('throws ConflictException when email already exists', async () => {
      userRepo.findOne.mockResolvedValue(mockUser());
      await expect(service.register({ email: 'test@example.com' } as any))
        .rejects.toThrow(ConflictException);
    });

    it('does not expose password in returned user', async () => {
      userRepo.findOne.mockResolvedValue(null);
      shopRepo.findOne.mockResolvedValue(null);
      userRepo.update.mockResolvedValue({});

      const result = await service.register({
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        password: 'Pass1234!',
      } as any);

      expect(result.user).not.toHaveProperty('password');
      expect(result.user).not.toHaveProperty('refreshToken');
    });

    // Security: SQL injection in email field should not cause errors
    it('handles SQL injection in email gracefully', async () => {
      userRepo.findOne.mockResolvedValue(null);
      shopRepo.findOne.mockResolvedValue(null);
      userRepo.update.mockResolvedValue({});

      await expect(
        service.register({ email: "'; DROP TABLE users; --", firstName: 'x', lastName: 'y', password: 'Pass1234!' } as any),
      ).resolves.toBeDefined();
    });
  });

  // ── login ─────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('returns tokens on valid credentials', async () => {
      const user = mockUser();
      userRepo.findOne.mockResolvedValue(user);
      userRepo.save.mockResolvedValue(user);
      userRepo.update.mockResolvedValue({});

      const result = await service.login({ email: 'test@example.com', password: 'Password1!' });
      expect(result).toHaveProperty('accessToken');
      expect(result.user).not.toHaveProperty('password');
    });

    it('throws UnauthorizedException for unknown email', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.login({ email: 'nobody@example.com', password: 'x' }))
        .rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for wrong password', async () => {
      const user = mockUser({ validatePassword: jest.fn().mockResolvedValue(false) });
      userRepo.findOne.mockResolvedValue(user);
      userRepo.update.mockResolvedValue({});

      await expect(service.login({ email: 'test@example.com', password: 'wrong' }))
        .rejects.toThrow(UnauthorizedException);
    });

    it('increments loginAttempts on wrong password', async () => {
      const user = mockUser({ loginAttempts: 3, validatePassword: jest.fn().mockResolvedValue(false) });
      userRepo.findOne.mockResolvedValue(user);
      userRepo.update.mockResolvedValue({});

      await expect(service.login({ email: 'test@example.com', password: 'wrong' })).rejects.toThrow();
      expect(userRepo.update).toHaveBeenCalledWith('user-uuid', expect.objectContaining({ loginAttempts: 4 }));
    });

    it('locks account after max login attempts', async () => {
      const user = mockUser({ loginAttempts: 4, validatePassword: jest.fn().mockResolvedValue(false) });
      userRepo.findOne.mockResolvedValue(user);
      userRepo.update.mockResolvedValue({});

      await expect(service.login({ email: 'test@example.com', password: 'bad' })).rejects.toThrow();
      expect(userRepo.update).toHaveBeenCalledWith('user-uuid', expect.objectContaining({ lockedUntil: expect.any(Date) }));
    });

    it('throws 429 when account is locked', async () => {
      const lockedUntil = new Date(Date.now() + 60_000);
      const user = mockUser({ lockedUntil });
      userRepo.findOne.mockResolvedValue(user);

      await expect(service.login({ email: 'test@example.com', password: 'x' }))
        .rejects.toThrow(HttpException);
    });

    it('throws UnauthorizedException for inactive account', async () => {
      const user = mockUser({ status: UserStatus.INACTIVE });
      userRepo.findOne.mockResolvedValue(user);
      userRepo.update.mockResolvedValue({});

      await expect(service.login({ email: 'test@example.com', password: 'Password1!' }))
        .rejects.toThrow(UnauthorizedException);
    });

    // Security: SQL injection in login credentials
    it('handles SQL injection in email without DB error', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.login({ email: "' OR 1=1 --", password: 'anything' }))
        .rejects.toThrow(UnauthorizedException);
    });

    it('handles excessively long password without crashing', async () => {
      userRepo.findOne.mockResolvedValue(null);
      const longPassword = 'A'.repeat(10_000);
      await expect(service.login({ email: 'test@example.com', password: longPassword }))
        .rejects.toThrow(UnauthorizedException);
    });
  });

  // ── refreshToken ──────────────────────────────────────────────────────────

  describe('refreshToken', () => {
    it('returns new tokens for valid refresh token', async () => {
      const hashed = await bcrypt.hash('valid-refresh', 10);
      const user = mockUser({ refreshToken: hashed });
      jwtService.verify.mockReturnValue({ sub: 'user-uuid' });
      userRepo.findOne.mockResolvedValue(user);
      userRepo.update.mockResolvedValue({});

      const result = await service.refreshToken({ refreshToken: 'valid-refresh' });
      expect(result).toHaveProperty('accessToken');
    });

    it('throws UnauthorizedException for invalid refresh token', async () => {
      jwtService.verify.mockImplementation(() => { throw new Error('invalid'); });
      await expect(service.refreshToken({ refreshToken: 'bad' })).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when token hash does not match', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-uuid' });
      const user = mockUser({ refreshToken: await bcrypt.hash('other-token', 10) });
      userRepo.findOne.mockResolvedValue(user);

      await expect(service.refreshToken({ refreshToken: 'forged-token' }))
        .rejects.toThrow(UnauthorizedException);
    });
  });

  // ── forgotPassword ────────────────────────────────────────────────────────

  describe('forgotPassword', () => {
    it('returns same message regardless of whether email exists (prevents enumeration)', async () => {
      userRepo.findOne.mockResolvedValue(null);
      const res = await service.forgotPassword('nobody@example.com');
      expect(res.message).toMatch(/if an account/i);
    });

    it('sends reset email when user exists', async () => {
      const user = mockUser();
      userRepo.findOne.mockResolvedValue(user);
      userRepo.update.mockResolvedValue({});

      await service.forgotPassword('test@example.com');
      expect(mailerService.sendPasswordReset).toHaveBeenCalledWith(
        'test@example.com', expect.any(String), expect.any(String),
      );
    });

    it('handles SQL injection in email without crashing', async () => {
      userRepo.findOne.mockResolvedValue(null);
      const res = await service.forgotPassword("'; DROP TABLE users; --");
      expect(res.message).toMatch(/if an account/i);
    });
  });

  // ── resetPassword ─────────────────────────────────────────────────────────

  describe('resetPassword', () => {
    it('throws NotFoundException for unknown token', async () => {
      const qb = { addSelect: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), getOne: jest.fn().mockResolvedValue(null) };
      userRepo.createQueryBuilder.mockReturnValue(qb);
      await expect(service.resetPassword('invalid-token', 'newPass1!')).rejects.toThrow(NotFoundException);
    });

    it('throws UnauthorizedException for expired token', async () => {
      const expired = new Date(Date.now() - 1000);
      const user = mockUser({ passwordResetExpires: expired });
      const qb = { addSelect: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), getOne: jest.fn().mockResolvedValue(user) };
      userRepo.createQueryBuilder.mockReturnValue(qb);

      await expect(service.resetPassword('some-token', 'newPass1!')).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── changePassword ────────────────────────────────────────────────────────

  describe('changePassword', () => {
    it('throws UnauthorizedException when current password is wrong', async () => {
      const user = mockUser({ validatePassword: jest.fn().mockResolvedValue(false) });
      userRepo.findOne.mockResolvedValue(user);

      await expect(service.changePassword('user-uuid', { currentPassword: 'wrong', newPassword: 'New1234!' } as any))
        .rejects.toThrow(UnauthorizedException);
    });

    it('throws NotFoundException when user does not exist', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.changePassword('bad-id', { currentPassword: 'x', newPassword: 'y' } as any))
        .rejects.toThrow(NotFoundException);
    });
  });
});
