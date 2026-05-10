import { Test, TestingModule } from '@nestjs/testing';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';
import { JwtAuthGuard, RolesGuard } from 'src/common/guards/auth.guard';
import { UserRole, UserStatus } from '../users/entities/user.entity';

const ORG_ID = 'org-uuid';
const SHOP_ID = 'shop-uuid';
const USER_ID = 'user-uuid';
const mockUser = { id: USER_ID, shopId: SHOP_ID, organizationId: ORG_ID };

const mockStaffService = () => ({
  create: jest.fn().mockResolvedValue({ data: { id: 'staff-id' } }),
  findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
  findOne: jest.fn().mockResolvedValue({ data: { id: 'staff-id' } }),
  update: jest.fn().mockResolvedValue({ data: { id: 'staff-id' } }),
  setPermissions: jest.fn().mockResolvedValue({ data: { id: 'staff-id' } }),
  transfer: jest.fn().mockResolvedValue({ data: { id: 'staff-id' } }),
  setStatus: jest.fn().mockResolvedValue({ message: 'status updated' }),
  remove: jest.fn().mockResolvedValue({ message: 'deleted' }),
  getPermissionsMeta: jest.fn().mockReturnValue([]),
});

describe('StaffController', () => {
  let controller: StaffController;
  let staffService: ReturnType<typeof mockStaffService>;

  beforeEach(async () => {
    staffService = mockStaffService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StaffController],
      providers: [{ provide: StaffService, useValue: staffService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    controller = module.get(StaffController);
  });

  it('create uses shopId and organizationId from JWT', async () => {
    const dto = { firstName: 'J', lastName: 'D', email: 'j@d.com', password: 'Pass1!', role: UserRole.CASHIER };
    await controller.create(dto as any, mockUser);
    expect(staffService.create).toHaveBeenCalledWith(dto, SHOP_ID, ORG_ID);
  });

  it('findAll scopes to organizationId from JWT', async () => {
    await controller.findAll({} as any, mockUser);
    expect(staffService.findAll).toHaveBeenCalledWith(ORG_ID, {});
  });

  it('findOne scopes to organizationId from JWT', async () => {
    await controller.findOne('staff-id', mockUser);
    expect(staffService.findOne).toHaveBeenCalledWith('staff-id', ORG_ID);
  });

  it('update scopes to organizationId from JWT', async () => {
    const dto = { firstName: 'Updated' };
    await controller.update('staff-id', dto as any, mockUser);
    expect(staffService.update).toHaveBeenCalledWith('staff-id', dto, ORG_ID);
  });

  it('setPermissions scopes to organizationId from JWT', async () => {
    const dto = { permissions: [] };
    await controller.setPermissions('staff-id', dto as any, mockUser);
    expect(staffService.setPermissions).toHaveBeenCalledWith('staff-id', dto, ORG_ID);
  });

  it('transfer scopes to organizationId from JWT', async () => {
    const dto = { shopId: 'new-shop' };
    await controller.transfer('staff-id', dto as any, mockUser);
    expect(staffService.transfer).toHaveBeenCalledWith('staff-id', dto.shopId, ORG_ID);
  });

  it('activate delegates setStatus ACTIVE with organizationId from JWT', async () => {
    await controller.activate('staff-id', mockUser);
    expect(staffService.setStatus).toHaveBeenCalledWith('staff-id', UserStatus.ACTIVE, ORG_ID);
  });

  it('deactivate delegates setStatus INACTIVE with organizationId from JWT', async () => {
    await controller.deactivate('staff-id', mockUser);
    expect(staffService.setStatus).toHaveBeenCalledWith('staff-id', UserStatus.INACTIVE, ORG_ID);
  });

  it('remove scopes to organizationId from JWT', async () => {
    await controller.remove('staff-id', mockUser);
    expect(staffService.remove).toHaveBeenCalledWith('staff-id', ORG_ID);
  });

  it('getPermissionsMeta returns list', () => {
    const result = controller.getPermissionsMeta();
    expect(Array.isArray(result)).toBe(true);
  });

  // Security: organizationId always from JWT, not from request params
  it('isolates org — cannot pass a different orgId via query params', async () => {
    // organizationId comes from JWT user object, query params are ignored for org scoping
    await controller.findAll({ organizationId: 'attacker-org' } as any, mockUser);
    expect(staffService.findAll).toHaveBeenCalledWith(ORG_ID, expect.anything());
  });
});
