import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Shop } from 'src/modules/shops/entities/shop.entity';
import { User } from 'src/modules/users/entities/user.entity';
import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { CreateShopDto, ShopFilterDto, UpdateShopDto } from './dto/shop.dto';
import { buildPaginationMeta } from 'src/common/dto/pagination.dto';
import { PlanService } from 'src/common/plans/plan.service';

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

  async findOne(id: string, requesterId?: string, isSuperAdmin = false) {
    const s = await this.shops.findOne({ where: { id } });
    if (!s) throw new NotFoundException('Shop not found');
    if (!isSuperAdmin && requesterId && s.ownerId !== requesterId) {
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

  async update(id: string, dto: UpdateShopDto, requesterId?: string, isSuperAdmin = false) {
    const s = await this.findOne(id);
    if (!isSuperAdmin && requesterId && s.ownerId !== requesterId) {
      throw new ForbiddenException('You do not have permission to update this shop');
    }
    return this.shops.save(Object.assign(s, dto));
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

  private async resolveUniqueSlug(base: string): Promise<string> {
    const baseSlug = base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    let slug = baseSlug;
    let attempt = 0;
    while (await this.shops.findOne({ where: { slug } })) {
      attempt++;
      slug = `${baseSlug}-${attempt}`;
      if (attempt > 50) throw new ConflictException('Could not generate a unique shop slug');
    }
    return slug;
  }
}
