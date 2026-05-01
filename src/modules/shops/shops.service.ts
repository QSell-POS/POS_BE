import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Shop } from 'src/modules/shops/entities/shop.entity';
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CreateShopDto, ShopFilterDto, UpdateShopDto } from './dto/shop.dto';
import { buildPaginationMeta } from 'src/common/dto/pagination.dto';

@Injectable()
export class ShopsService {
  constructor(@InjectRepository(Shop) private shops: Repository<Shop>) {}

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

  async findOne(id: string, requesterId?: string, isSuperAdmin = false) {
    const s = await this.shops.findOne({ where: { id } });
    if (!s) throw new NotFoundException('Shop not found');
    if (!isSuperAdmin && requesterId && s.ownerId !== requesterId) {
      throw new ForbiddenException('You do not have permission to access this shop');
    }
    return s;
  }

  async create(dto: CreateShopDto, ownerId: string) {
    const shop = this.shops.create({ ...dto, ownerId });
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
}
