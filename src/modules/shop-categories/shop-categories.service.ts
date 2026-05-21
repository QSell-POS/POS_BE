import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShopCategory } from './entities/shop-category.entity';

export class CreateShopCategoryDto {
  key: string;
  name: string;
  description?: string;
  icon?: string;
  sortOrder?: number;
}

@Injectable()
export class ShopCategoriesService {
  constructor(
    @InjectRepository(ShopCategory) private repo: Repository<ShopCategory>,
  ) {}

  async findAll(includeInactive = false) {
    const where = includeInactive ? {} : { isActive: true };
    const data = await this.repo.find({ where, order: { sortOrder: 'ASC', name: 'ASC' } });
    return { data, message: 'Shop categories fetched successfully' };
  }

  async findOne(id: string) {
    const cat = await this.repo.findOne({ where: { id } });
    if (!cat) throw new NotFoundException('Shop category not found');
    return { data: cat, message: 'Shop category retrieved successfully' };
  }

  async create(dto: CreateShopCategoryDto) {
    const existing = await this.repo.findOne({ where: { key: dto.key } });
    if (existing) throw new ConflictException(`Category key '${dto.key}' already exists`);
    const cat = await this.repo.save(this.repo.create(dto));
    return { data: cat, message: 'Shop category created successfully' };
  }

  async update(id: string, dto: Partial<CreateShopCategoryDto> & { isActive?: boolean }) {
    const cat = await this.repo.findOne({ where: { id } });
    if (!cat) throw new NotFoundException('Shop category not found');
    Object.assign(cat, dto);
    const saved = await this.repo.save(cat);
    return { data: saved, message: 'Shop category updated successfully' };
  }

  async remove(id: string) {
    const cat = await this.repo.findOne({ where: { id } });
    if (!cat) throw new NotFoundException('Shop category not found');
    await this.repo.remove(cat);
    return { message: 'Shop category deleted successfully' };
  }
}
