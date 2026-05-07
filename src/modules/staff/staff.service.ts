import {
  Injectable, NotFoundException, ConflictException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { User, UserRole, UserStatus } from '../users/entities/user.entity';
import { Shop } from '../shops/entities/shop.entity';
import { DEFAULT_PERMISSIONS, Permission, PERMISSION_META } from 'src/common/permissions/permission.enum';
import { PlanService } from 'src/common/plans/plan.service';
import { buildPaginationMeta } from 'src/common/dto/pagination.dto';
import { CreateStaffDto, SetPermissionsDto, StaffFilterDto, UpdateStaffDto } from './staff.dto';

/** Staff roles — any User that is NOT ADMIN or SUPER_ADMIN is considered staff */
const STAFF_ROLES: UserRole[] = [UserRole.MANAGER, UserRole.CASHIER, UserRole.VIEWER];

@Injectable()
export class StaffService {
  constructor(
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(Shop) private shops: Repository<Shop>,
    private planService: PlanService,
  ) {}

  private async assertShopInOrg(shopId: string, organizationId: string): Promise<Shop> {
    const shop = await this.shops.findOne({ where: { id: shopId } });
    if (!shop) throw new NotFoundException('Shop not found');
    if (shop.organizationId !== organizationId) {
      throw new ForbiddenException('That shop does not belong to your organization');
    }
    return shop;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private safeUser(u: User) {
    const { password, refreshToken, emailVerifyToken, passwordResetToken, ...rest } = u as any;
    return rest;
  }

  private assertStaff(user: User) {
    if (!STAFF_ROLES.includes(user.role)) {
      throw new ForbiddenException('This user is an admin and cannot be managed as staff.');
    }
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async create(
    dto: CreateStaffDto,
    callerShopId: string,
    organizationId: string,
  ): Promise<{ data: any; message: string }> {
    const existing = await this.users.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('A user with this email already exists.');

    const targetShopId = dto.shopId ?? callerShopId;
    if (dto.shopId) {
      await this.assertShopInOrg(dto.shopId, organizationId);
    }

    const staffCount = await this.users.count({ where: { shopId: targetShopId } });
    await this.planService.assertQuantity(targetShopId, 'maxStaff', staffCount);

    const permissions = DEFAULT_PERMISSIONS[dto.role] ?? [];

    const staff = this.users.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      password: dto.password,
      phone: dto.phone,
      role: dto.role,
      permissions,
      shopId: targetShopId,
      organizationId,
      status: UserStatus.ACTIVE,
    });

    const saved = await this.users.save(staff);
    return { data: this.safeUser(saved), message: 'Staff member created successfully.' };
  }

  async transfer(
    id: string,
    targetShopId: string,
    organizationId: string,
  ): Promise<{ data: any; message: string }> {
    const user = await this.users.findOne({ where: { id, organizationId } });
    if (!user) throw new NotFoundException('Staff member not found.');
    this.assertStaff(user);

    if (user.shopId === targetShopId) {
      return { data: this.safeUser(user), message: 'Staff is already in that shop.' };
    }

    await this.assertShopInOrg(targetShopId, organizationId);

    const targetCount = await this.users.count({ where: { shopId: targetShopId } });
    await this.planService.assertQuantity(targetShopId, 'maxStaff', targetCount);

    user.shopId = targetShopId;
    const saved = await this.users.save(user);
    return { data: this.safeUser(saved), message: 'Staff member transferred successfully.' };
  }

  async findAll(organizationId: string, filters: StaffFilterDto & { shopId?: string }) {
    const { search, status, page = 1, limit = 20, shopId } = filters;

    const qb = this.users
      .createQueryBuilder('u')
      .where('u.organizationId = :organizationId', { organizationId })
      .andWhere('u.role IN (:...roles)', { roles: STAFF_ROLES })
      .andWhere('u.deletedAt IS NULL');

    if (shopId) qb.andWhere('u.shopId = :shopId', { shopId });

    if (search) {
      qb.andWhere(
        '(u.firstName ILIKE :s OR u.lastName ILIKE :s OR u.email ILIKE :s)',
        { s: `%${search}%` },
      );
    }
    if (status) qb.andWhere('u.status = :status', { status });

    const total = await qb.getCount();
    const data = await qb
      .select([
        'u.id', 'u.firstName', 'u.lastName', 'u.email', 'u.phone',
        'u.role', 'u.status', 'u.permissions', 'u.avatar', 'u.lastLoginAt', 'u.createdAt',
        'u.shopId',
      ])
      .orderBy('u.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      data,
      message: 'Staff retrieved successfully.',
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  async findOne(id: string, organizationId: string) {
    const user = await this.users.findOne({
      where: { id, organizationId },
      select: [
        'id', 'firstName', 'lastName', 'email', 'phone',
        'role', 'status', 'permissions', 'avatar', 'lastLoginAt', 'createdAt', 'updatedAt',
        'shopId',
      ],
    });
    if (!user) throw new NotFoundException('Staff member not found.');
    this.assertStaff(user);
    return { data: user, message: 'Staff member retrieved successfully.' };
  }

  async update(id: string, dto: UpdateStaffDto, organizationId: string) {
    const user = await this.users.findOne({ where: { id, organizationId } });
    if (!user) throw new NotFoundException('Staff member not found.');
    this.assertStaff(user);
    Object.assign(user, dto);
    const saved = await this.users.save(user);
    return { data: this.safeUser(saved), message: 'Staff member updated successfully.' };
  }

  async setPermissions(id: string, dto: SetPermissionsDto, organizationId: string) {
    const user = await this.users.findOne({ where: { id, organizationId } });
    if (!user) throw new NotFoundException('Staff member not found.');
    this.assertStaff(user);
    user.permissions = dto.permissions;
    const saved = await this.users.save(user);
    return { data: this.safeUser(saved), message: 'Permissions updated successfully.' };
  }

  async setStatus(id: string, status: UserStatus, organizationId: string) {
    const user = await this.users.findOne({ where: { id, organizationId } });
    if (!user) throw new NotFoundException('Staff member not found.');
    this.assertStaff(user);
    user.status = status;
    await this.users.save(user);
    return { message: `Staff member ${status === UserStatus.ACTIVE ? 'activated' : 'deactivated'} successfully.` };
  }

  async remove(id: string, organizationId: string) {
    const user = await this.users.findOne({ where: { id, organizationId } });
    if (!user) throw new NotFoundException('Staff member not found.');
    this.assertStaff(user);
    await this.users.softDelete(id);
    return { message: 'Staff member removed successfully.' };
  }

  /** Return all available permissions with metadata, grouped by module */
  getPermissionsMeta() {
    return { data: PERMISSION_META, message: 'Permissions metadata retrieved.' };
  }
}
