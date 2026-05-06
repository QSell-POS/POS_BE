import {
  Injectable, NotFoundException, ConflictException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { User, UserRole, UserStatus } from '../users/entities/user.entity';
import { Permission, PERMISSION_META, PRESET_PERMISSIONS, StaffPreset } from 'src/common/permissions/permission.enum';
import { buildPaginationMeta } from 'src/common/dto/pagination.dto';
import { CreateStaffDto, SetPermissionsDto, StaffFilterDto, UpdateStaffDto, ApplyPresetDto } from './staff.dto';

/** Staff roles — any User that is NOT ADMIN or SUPER_ADMIN is considered staff */
const STAFF_ROLES: UserRole[] = [UserRole.MANAGER, UserRole.CASHIER, UserRole.VIEWER];

/** Determine which UserRole a preset maps to */
const PRESET_TO_ROLE: Record<StaffPreset, UserRole> = {
  [StaffPreset.CASHIER]:          UserRole.CASHIER,
  [StaffPreset.INVENTORY_CLERK]:  UserRole.CASHIER,
  [StaffPreset.MANAGER]:          UserRole.MANAGER,
  [StaffPreset.CUSTOM]:           UserRole.CASHIER,
};

@Injectable()
export class StaffService {
  constructor(@InjectRepository(User) private users: Repository<User>) {}

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

  async create(dto: CreateStaffDto, shopId: string): Promise<{ data: any; message: string }> {
    const existing = await this.users.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('A user with this email already exists.');

    const permissions: Permission[] = dto.permissions ?? PRESET_PERMISSIONS[dto.preset];
    const role: UserRole = PRESET_TO_ROLE[dto.preset];

    const staff = this.users.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      password: dto.password, // hashed by @BeforeInsert on the entity
      phone: dto.phone,
      role,
      permissions,
      shopId,
      status: UserStatus.ACTIVE,
    });

    const saved = await this.users.save(staff);
    return { data: this.safeUser(saved), message: 'Staff member created successfully.' };
  }

  async findAll(shopId: string, filters: StaffFilterDto) {
    const { search, status, page = 1, limit = 20 } = filters;

    const qb = this.users
      .createQueryBuilder('u')
      .where('u.shopId = :shopId', { shopId })
      .andWhere('u.role IN (:...roles)', { roles: STAFF_ROLES })
      .andWhere('u.deletedAt IS NULL');

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

  async findOne(id: string, shopId: string) {
    const user = await this.users.findOne({
      where: { id, shopId },
      select: [
        'id', 'firstName', 'lastName', 'email', 'phone',
        'role', 'status', 'permissions', 'avatar', 'lastLoginAt', 'createdAt', 'updatedAt',
      ],
    });
    if (!user) throw new NotFoundException('Staff member not found.');
    this.assertStaff(user);
    return { data: user, message: 'Staff member retrieved successfully.' };
  }

  async update(id: string, dto: UpdateStaffDto, shopId: string) {
    const user = await this.users.findOne({ where: { id, shopId } });
    if (!user) throw new NotFoundException('Staff member not found.');
    this.assertStaff(user);
    Object.assign(user, dto);
    const saved = await this.users.save(user);
    return { data: this.safeUser(saved), message: 'Staff member updated successfully.' };
  }

  async setPermissions(id: string, dto: SetPermissionsDto, shopId: string) {
    const user = await this.users.findOne({ where: { id, shopId } });
    if (!user) throw new NotFoundException('Staff member not found.');
    this.assertStaff(user);
    user.permissions = dto.permissions;
    const saved = await this.users.save(user);
    return { data: this.safeUser(saved), message: 'Permissions updated successfully.' };
  }

  async applyPreset(id: string, dto: ApplyPresetDto, shopId: string) {
    const user = await this.users.findOne({ where: { id, shopId } });
    if (!user) throw new NotFoundException('Staff member not found.');
    this.assertStaff(user);
    user.permissions = PRESET_PERMISSIONS[dto.preset];
    user.role = PRESET_TO_ROLE[dto.preset];
    const saved = await this.users.save(user);
    return { data: this.safeUser(saved), message: `Preset '${dto.preset}' applied successfully.` };
  }

  async setStatus(id: string, status: UserStatus, shopId: string) {
    const user = await this.users.findOne({ where: { id, shopId } });
    if (!user) throw new NotFoundException('Staff member not found.');
    this.assertStaff(user);
    user.status = status;
    await this.users.save(user);
    return { message: `Staff member ${status === UserStatus.ACTIVE ? 'activated' : 'deactivated'} successfully.` };
  }

  async remove(id: string, shopId: string) {
    const user = await this.users.findOne({ where: { id, shopId } });
    if (!user) throw new NotFoundException('Staff member not found.');
    this.assertStaff(user);
    await this.users.softDelete(id);
    return { message: 'Staff member removed successfully.' };
  }

  /** Return all available permissions with metadata, grouped by module */
  getPermissionsMeta() {
    return { data: PERMISSION_META, message: 'Permissions metadata retrieved.' };
  }

  /** Return all presets with their default permission lists */
  getPresets() {
    const entries = Object.values(StaffPreset).map((preset) => ({
      preset,
      role: PRESET_TO_ROLE[preset],
      permissions: PRESET_PERMISSIONS[preset],
    }));
    return { data: entries, message: 'Staff presets retrieved.' };
  }
}
