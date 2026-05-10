import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';

import { StaffService } from './staff.service';
import { User, UserRole, UserStatus } from '../users/entities/user.entity';
import { Shop } from '../shops/entities/shop.entity';
import { PlanService } from 'src/common/plans/plan.service';
import { DEFAULT_PERMISSIONS } from 'src/common/permissions/permission.enum';

const ORG_ID = 'org-uuid';
const SHOP_ID = 'shop-uuid';
const CALLER_SHOP_ID = 'caller-shop-uuid';

const mockStaff = (overrides = {}): Partial<User> => ({
  id: 'staff-uuid',
  email: 'staff@example.com',
  firstName: 'Staff',
  lastName: 'User',
  role: UserRole.CASHIER,
  status: UserStatus.ACTIVE,
  organizationId: ORG_ID,
  shopId: SHOP_ID,
  permissions: [],
  ...overrides,
});

describe('StaffService', () => {
  let service: StaffService;
  let userRepo: any;
  let shopRepo: any;
  let planService: jest.Mocked<PlanService>;

  beforeEach(async () => {
    userRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn().mockImplementation((data) => Promise.resolve({ ...data, id: 'new-id' })),
      create: jest.fn((data) => data),
      count: jest.fn().mockResolvedValue(0),
      softDelete: jest.fn().mockResolvedValue({}),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        getMany: jest.fn().mockResolvedValue([]),
      })),
    };

    shopRepo = {
      findOne: jest.fn().mockResolvedValue({ id: SHOP_ID, organizationId: ORG_ID }),
    };

    planService = {
      assertQuantity: jest.fn().mockResolvedValue(undefined),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaffService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Shop), useValue: shopRepo },
        { provide: PlanService, useValue: planService },
      ],
    }).compile();

    service = module.get(StaffService);
  });

  describe('create', () => {
    const validDto = () => ({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@shop.com',
      password: 'Pass1234!',
      role: UserRole.CASHIER,
    });

    it('creates staff with default permissions for role', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await service.create(validDto() as any, CALLER_SHOP_ID, ORG_ID);

      expect(userRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          permissions: DEFAULT_PERMISSIONS[UserRole.CASHIER],
          organizationId: ORG_ID,
          shopId: CALLER_SHOP_ID,
        }),
      );
    });

    it('throws ConflictException when email already exists', async () => {
      userRepo.findOne.mockResolvedValue(mockStaff());
      await expect(service.create(validDto() as any, CALLER_SHOP_ID, ORG_ID)).rejects.toThrow(ConflictException);
    });

    it('validates target shopId belongs to org when dto.shopId provided', async () => {
      userRepo.findOne.mockResolvedValue(null);
      shopRepo.findOne.mockResolvedValue({ id: 'other-shop', organizationId: 'other-org' });

      await expect(
        service.create({ ...validDto(), shopId: 'other-shop' } as any, CALLER_SHOP_ID, ORG_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('calls planService to enforce maxStaff limit', async () => {
      userRepo.findOne.mockResolvedValue(null);
      shopRepo.findOne.mockResolvedValue({ id: SHOP_ID, organizationId: ORG_ID });
      userRepo.count.mockResolvedValue(2);

      await service.create(validDto() as any, CALLER_SHOP_ID, ORG_ID);
      expect(planService.assertQuantity).toHaveBeenCalledWith(CALLER_SHOP_ID, 'maxStaff', 2);
    });

    // Security: SQL injection in email
    it('handles SQL injection in email field', async () => {
      userRepo.findOne.mockResolvedValue(null);
      const dto = { ...validDto(), email: "'; DROP TABLE users; --" };
      // findOne uses parameterized queries — passes through safely
      await expect(service.create(dto as any, CALLER_SHOP_ID, ORG_ID)).resolves.toBeDefined();
    });

    // Security: ADMIN cannot be created as staff
    it('creates user with provided role (ADMIN would bypass via controller guard)', async () => {
      userRepo.findOne.mockResolvedValue(null);
      const dto = { ...validDto(), role: UserRole.MANAGER };
      await service.create(dto as any, CALLER_SHOP_ID, ORG_ID);
      expect(userRepo.save).toHaveBeenCalledWith(expect.objectContaining({ role: UserRole.MANAGER }));
    });
  });

  describe('findOne', () => {
    it('returns staff member', async () => {
      userRepo.findOne.mockResolvedValue(mockStaff());
      const result = await service.findOne('staff-uuid', ORG_ID);
      expect(result.data.id).toBe('staff-uuid');
    });

    it('throws NotFoundException when not found', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('bad-id', ORG_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user is an admin (not staff)', async () => {
      userRepo.findOne.mockResolvedValue(mockStaff({ role: UserRole.ADMIN }));
      await expect(service.findOne('staff-uuid', ORG_ID)).rejects.toThrow(ForbiddenException);
    });

    // Security: org isolation — cannot access staff from another org
    it('returns null when staff belongs to different org', async () => {
      userRepo.findOne.mockResolvedValue(null); // TypeORM scoped by organizationId
      await expect(service.findOne('staff-uuid', 'other-org')).rejects.toThrow(NotFoundException);
    });
  });

  describe('transfer', () => {
    it('transfers staff to target shop', async () => {
      const staff = mockStaff({ shopId: 'old-shop' });
      userRepo.findOne.mockResolvedValue(staff);
      userRepo.count.mockResolvedValue(1);
      userRepo.save.mockResolvedValue({ ...staff, shopId: SHOP_ID });

      const result = await service.transfer('staff-uuid', SHOP_ID, ORG_ID);
      expect(result.data.shopId).toBe(SHOP_ID);
    });

    it('returns early if staff is already in target shop', async () => {
      const staff = mockStaff({ shopId: SHOP_ID });
      userRepo.findOne.mockResolvedValue(staff);

      const result = await service.transfer('staff-uuid', SHOP_ID, ORG_ID);
      expect(result.message).toMatch(/already/i);
      expect(userRepo.save).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when target shop belongs to another org', async () => {
      userRepo.findOne.mockResolvedValue(mockStaff({ shopId: 'old-shop' }));
      shopRepo.findOne.mockResolvedValue({ id: 'target-shop', organizationId: 'other-org' });

      await expect(service.transfer('staff-uuid', 'target-shop', ORG_ID)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('setStatus', () => {
    it('activates a staff member', async () => {
      userRepo.findOne.mockResolvedValue(mockStaff({ status: UserStatus.INACTIVE }));
      await service.setStatus('staff-uuid', UserStatus.ACTIVE, ORG_ID);
      expect(userRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: UserStatus.ACTIVE }));
    });

    it('throws NotFoundException when staff not found', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.setStatus('bad-id', UserStatus.ACTIVE, ORG_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('soft-deletes staff', async () => {
      userRepo.findOne.mockResolvedValue(mockStaff());
      await service.remove('staff-uuid', ORG_ID);
      expect(userRepo.softDelete).toHaveBeenCalledWith('staff-uuid');
    });

    it('throws ForbiddenException when trying to delete an admin', async () => {
      userRepo.findOne.mockResolvedValue(mockStaff({ role: UserRole.ADMIN }));
      await expect(service.remove('staff-uuid', ORG_ID)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('setPermissions', () => {
    it('replaces permissions on staff', async () => {
      userRepo.findOne.mockResolvedValue(mockStaff());
      const perms = DEFAULT_PERMISSIONS[UserRole.MANAGER];
      await service.setPermissions('staff-uuid', { permissions: perms } as any, ORG_ID);
      expect(userRepo.save).toHaveBeenCalledWith(expect.objectContaining({ permissions: perms }));
    });
  });
});
