import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from 'src/common/guards/auth.guard';

const mockAuthService = () => ({
  getProfile: jest.fn().mockResolvedValue({ data: { id: 'user-id' } }),
  register: jest.fn().mockResolvedValue({ message: 'registered' }),
  login: jest.fn().mockResolvedValue({ data: { accessToken: 'token' } }),
  refreshToken: jest.fn().mockResolvedValue({ data: { accessToken: 'new-token' } }),
  logout: jest.fn().mockResolvedValue({ message: 'logged out' }),
  changePassword: jest.fn().mockResolvedValue({ message: 'changed' }),
  forgotPassword: jest.fn().mockResolvedValue({ message: 'email sent' }),
  resetPassword: jest.fn().mockResolvedValue({ message: 'reset' }),
  verifyEmail: jest.fn().mockResolvedValue({ message: 'verified' }),
  sendEmailVerification: jest.fn().mockResolvedValue({ message: 'sent' }),
});

describe('AuthController', () => {
  let controller: AuthController;
  let authService: ReturnType<typeof mockAuthService>;

  beforeEach(async () => {
    authService = mockAuthService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AuthController);
  });

  it('getProfile delegates to authService', async () => {
    const result = await controller.getProfile({ id: 'user-id' });
    expect(authService.getProfile).toHaveBeenCalledWith('user-id');
    expect(result).toBeDefined();
  });

  it('register delegates to authService', async () => {
    const dto = { email: 'test@test.com', password: 'Pass1234!', firstName: 'A', lastName: 'B', orgName: 'Org' };
    const result = await controller.register(dto as any);
    expect(authService.register).toHaveBeenCalledWith(dto);
    expect(result.message).toBe('registered');
  });

  it('login delegates to authService', async () => {
    const dto = { email: 'test@test.com', password: 'Pass1234!' };
    const result = await controller.login(dto as any);
    expect(authService.login).toHaveBeenCalledWith(dto);
    expect(result.data.accessToken).toBeDefined();
  });

  it('refresh delegates to authService', async () => {
    const dto = { refreshToken: 'tok' };
    const result = await controller.refresh(dto as any);
    expect(authService.refreshToken).toHaveBeenCalledWith(dto);
    expect(result.data.accessToken).toBe('new-token');
  });

  it('logout delegates to authService', async () => {
    const result = await controller.logout({ id: 'user-id' });
    expect(authService.logout).toHaveBeenCalledWith('user-id');
    expect(result).toBeDefined();
  });

  it('changePassword delegates to authService', async () => {
    const dto = { oldPassword: 'old', newPassword: 'New1234!' };
    await controller.changePassword({ id: 'user-id' }, dto as any);
    expect(authService.changePassword).toHaveBeenCalledWith('user-id', dto);
  });

  it('forgotPassword delegates to authService', async () => {
    const dto = { email: 'test@test.com' };
    const result = await controller.forgotPassword(dto as any);
    expect(authService.forgotPassword).toHaveBeenCalledWith(dto.email);
    expect(result).toBeDefined();
  });

  it('resetPassword delegates to authService', async () => {
    const dto = { token: 'abc', newPassword: 'New1234!' };
    await controller.resetPassword(dto as any);
    expect(authService.resetPassword).toHaveBeenCalledWith(dto.token, dto.newPassword);
  });

  it('verifyEmail delegates to authService', async () => {
    const dto = { token: 'verify-token' };
    await controller.verifyEmail(dto as any);
    expect(authService.verifyEmail).toHaveBeenCalledWith(dto.token);
  });

  it('resendVerification delegates to authService', async () => {
    await controller.resendVerification({ id: 'user-id' });
    expect(authService.sendEmailVerification).toHaveBeenCalledWith('user-id');
  });

  // Security: SQL injection in email should pass through to service (parameterized at DB layer)
  it('passes SQL injection email safely to authService', async () => {
    const dto = { email: "' OR 1=1 --", password: 'any' };
    await controller.login(dto as any);
    expect(authService.login).toHaveBeenCalledWith(dto);
  });
});
