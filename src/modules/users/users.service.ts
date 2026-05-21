import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole, UserStatus } from './entities/user.entity';
import { Shop } from '../shops/entities/shop.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { UpdateUserDto, UserFilterDto } from './dto/user.dto';
import { buildPaginationMeta } from 'src/common/dto/pagination.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(Shop) private shops: Repository<Shop>,
    @InjectRepository(Organization) private orgs: Repository<Organization>,
  ) {}

  private async attachFlatFields(users: User[]): Promise<any[]> {
    if (!users.length) return [];

    const shopIds = [...new Set(users.map(u => u.shopId).filter(Boolean))];
    const orgIds  = [...new Set(users.map(u => u.organizationId).filter(Boolean))];

    const [shopList, orgList] = await Promise.all([
      shopIds.length ? this.shops.findByIds(shopIds) : [],
      orgIds.length  ? this.orgs.findByIds(orgIds)   : [],
    ]);

    const shopMap = Object.fromEntries(shopList.map(s => [s.id, s.name]));
    const orgMap  = Object.fromEntries(orgList.map(o  => [o.id, o.name]));

    return users.map(u => ({
      ...u,
      name:     `${u.firstName} ${u.lastName}`.trim(),
      shopName: shopMap[u.shopId]          ?? null,
      orgName:  orgMap[u.organizationId]   ?? null,
    }));
  }

  async findAll(shopId: string, filters: UserFilterDto, isSuper: boolean) {
    const { search, role, status, page = 1, limit = 20 } = filters;
    const qb = this.users.createQueryBuilder('u');
    if (!isSuper) qb.where('u.shopId = :shopId', { shopId });
    if (search)
      qb.andWhere('(u.firstName ILIKE :s OR u.lastName ILIKE :s OR u.email ILIKE :s)', { s: `%${search}%` });
    if (role)   qb.andWhere('u.role = :role', { role });
    if (status) qb.andWhere('u.status = :status', { status });

    const total = await qb.getCount();
    const raw = await qb
      .select([
        'u.id', 'u.firstName', 'u.lastName', 'u.email', 'u.phone',
        'u.role', 'u.status', 'u.shopId', 'u.organizationId',
        'u.avatar', 'u.lastLoginAt', 'u.emailVerified', 'u.createdAt',
      ])
      .orderBy('u.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    const data = await this.attachFlatFields(raw);
    return { data, message: 'Users fetched successfully', meta: buildPaginationMeta(total, page, limit) };
  }

  async findOne(id: string, shopId: string, isSuper: boolean) {
    const u = await this.users.findOne({
      where: isSuper ? { id } : { id, shopId },
      select: [
        'id', 'firstName', 'lastName', 'email', 'phone', 'role', 'status',
        'shopId', 'organizationId', 'avatar', 'lastLoginAt', 'emailVerified',
        'createdAt', 'updatedAt',
      ],
    });
    if (!u) throw new NotFoundException('User not found');
    const [withFields] = await this.attachFlatFields([u]);
    return withFields;
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    requesterId: string,
    requesterRole: UserRole,
    shopId: string,
  ) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    // Non-admins can only update themselves
    if (
      requesterId !== id &&
      requesterRole !== UserRole.ADMIN &&
      requesterRole !== UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException('You can only update your own profile');
    }
    // Only admin/super_admin can change role/status/shopId
    if (
      dto.role &&
      requesterRole !== UserRole.ADMIN &&
      requesterRole !== UserRole.SUPER_ADMIN
    ) {
      delete dto.role;
    }
    Object.assign(user, dto);
    const saved = await this.users.save(user);
    const { password, refreshToken, ...rest } = saved as any;
    return { data: rest, message: 'User updated successfully' };
  }

  async deactivate(id: string, shopId: string, isSuper: boolean) {
    await this.findOne(id, shopId, isSuper);
    await this.users.update(id, { status: UserStatus.INACTIVE });
    return { message: 'User deactivated successfully' };
  }

  async restore(id: string, shopId: string, isSuper: boolean) {
    const user = await this.users.findOne({
      where: isSuper ? { id } : { id, shopId },
      withDeleted: true,
    });
    if (!user) throw new NotFoundException('User not found');
    await this.users.restore(id);
    await this.users.update(id, { status: UserStatus.ACTIVE });
    return { message: 'User restored successfully' };
  }
}
