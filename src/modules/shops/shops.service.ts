import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { customAlphabet } from 'nanoid';
import { Shop } from 'src/modules/shops/entities/shop.entity';
import { User } from 'src/modules/users/entities/user.entity';
import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';

const shopIdSuffix = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 6);
import { CreateShopDto, ShopFilterDto, UpdateShopDto } from './dto/shop.dto';
import { buildPaginationMeta } from 'src/common/dto/pagination.dto';
import { PlanService } from 'src/common/modules/plans/plan.service';

@Injectable()
export class ShopsService {
  constructor(
    @InjectRepository(Shop) private shops: Repository<Shop>,
    @InjectRepository(User) private users: Repository<User>,
    private planService: PlanService,
  ) {}

  async findAll(filters: ShopFilterDto) {
    const { search, page = 1, limit = 20 } = filters;
    const qb = this.shops.createQueryBuilder('s');
    if (search) {
      qb.where('(s.name ILIKE :search OR s.slug ILIKE :search)', { search: `%${search}%` });
    }

    const total = await qb.getCount();
    const data = await qb
      .orderBy('s.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      data,
      message: 'Shops fetched successfully',
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  async findMyOrgShops(organizationId: string) {
    const data = await this.shops.find({
      where: { organizationId },
      order: { createdAt: 'ASC' },
    });
    return { data, message: 'Shops fetched successfully' };
  }

  async findOne(id: string, organizationId?: string, userShopId?: string, isSuperAdmin = false) {
    const s = await this.shops.findOne({ where: { id } });
    if (!s) throw new NotFoundException('Shop not found');
    if (isSuperAdmin) return s;
    const inSameOrg = organizationId && s.organizationId === organizationId;
    const isOwnShop = userShopId && s.id === userShopId;
    if (!inSameOrg && !isOwnShop) {
      throw new ForbiddenException('You do not have permission to access this shop');
    }
    return s;
  }

  async createForOrg(dto: CreateShopDto, ownerId: string, organizationId: string) {
    const count = await this.shops.count({ where: { organizationId } });
    await this.planService.assertOrgQuantity(organizationId, 'maxShops', count);

    const slug = await this.resolveUniqueSlug(dto.slug || dto.name);
    const shop = this.shops.create({ ...dto, slug, ownerId, organizationId });
    return this.shops.save(shop);
  }

  async update(id: string, dto: UpdateShopDto, organizationId?: string, isSuperAdmin = false) {
    const s = await this.findOne(id, organizationId, undefined, isSuperAdmin);
    const patch: Partial<Shop> = { ...dto };
    if (dto.slug !== undefined && dto.slug !== s.slug) {
      patch.slug = await this.resolveUniqueSlug(dto.slug, id);
    }
    return this.shops.save(Object.assign(s, patch));
  }

  async getMyShop(shopId: string) {
    return {
      data: await this.findOne(shopId),
    };
  }

  async findByOwner(ownerId: string) {
    return this.shops.find({ where: { ownerId } });
  }

  async assertShopInOrg(shopId: string, organizationId: string): Promise<Shop> {
    const shop = await this.shops.findOne({ where: { id: shopId } });
    if (!shop) throw new NotFoundException('Shop not found');
    if (shop.organizationId !== organizationId) {
      throw new ForbiddenException('That shop does not belong to your organization');
    }
    return shop;
  }

  async switchShop(userId: string, organizationId: string, targetShopId: string) {
    const shop = await this.assertShopInOrg(targetShopId, organizationId);
    await this.users.update(userId, { shopId: shop.id });
    return { data: shop, message: 'Active shop switched successfully' };
  }

  private async resolveUniqueSlug(base: string, ignoreShopId?: string): Promise<string> {
    const baseSlug = base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    if (!baseSlug) throw new ConflictException('Shop slug cannot be empty');

    const slug = `${baseSlug}-${shopIdSuffix()}`;
    const existing = await this.shops.findOne({ where: { slug } });
    if (existing && existing.id !== ignoreShopId) {
      // 36^6 ≈ 2B combos — collisions are astronomically rare, but retry once just in case.
      const retry = `${baseSlug}-${shopIdSuffix()}`;
      const clash = await this.shops.findOne({ where: { slug: retry } });
      if (clash && clash.id !== ignoreShopId) {
        throw new ConflictException('Could not generate a unique shop slug');
      }
      return retry;
    }
    return slug;
  }
}
