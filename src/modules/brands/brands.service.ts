import { Injectable, NotFoundException } from '@nestjs/common';

import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateBrandDto, UpdateBrandDto } from './dto/brand.dto';
import { Brand } from './entities/brand.entity';

@Injectable()
export class BrandsService {
  constructor(
    @InjectRepository(Brand)
    private brands: Repository<Brand>,
  ) {}

  findAll(shopId: string, search?: string) {
    const qb = this.brands.createQueryBuilder('b').where('b.shopId = :shopId', { shopId });
    if (search) qb.andWhere('b.name ILIKE :search', { search: `%${search}%` });
    return qb.orderBy('b.name', 'ASC').getMany();
  }

  async findOne(id: string, shopId: string) {
    const brand = await this.brands.findOne({ where: { id, shopId } });
    if (!brand) throw new NotFoundException('Brand not found');
    return brand;
  }

  async create(dto: CreateBrandDto, shopId: string) {
    const brand = this.brands.create({ ...dto, shopId });
    return this.brands.save(brand);
  }

  async update(id: string, data: UpdateBrandDto, shopId: string) {
    const brand = await this.findOne(id, shopId);
    return this.brands.save(Object.assign(brand, data));
  }

  async remove(id: string, shopId: string) {
    await this.findOne(id, shopId);
    await this.brands.softDelete(id);
    return { message: 'Brand deleted' };
  }
}
