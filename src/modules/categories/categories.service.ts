import { TreeRepository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Category } from './entities/category.entity';
import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private categories: TreeRepository<Category>,
  ) {}

  async findAll(shopId: string) {
    const categories = await this.categories
      .createQueryBuilder('c')
      .where('c.shopId = :shopId', { shopId })
      .andWhere('c.deletedAt IS NULL')
      .getMany();

    return {
      data: this.buildTree(categories),
      message: 'Category tree retrieved successfully',
    };
  }

  buildTree(categories: any[]) {
    const map = new Map();
    const roots = [];

    categories.forEach((cat) => {
      map.set(cat.id, { ...cat, children: [] });
    });

    categories.forEach((cat) => {
      if (cat.parentId) {
        const parent = map.get(cat.parentId);
        if (parent) {
          parent.children.push(map.get(cat.id));
        }
      } else {
        roots.push(map.get(cat.id));
      }
    });

    return roots;
  }

  async findFlat(shopId: string, search?: string) {
    const qb = this.categories.createQueryBuilder('c').leftJoinAndSelect('c.parent', 'parent').where('c.shopId = :shopId', { shopId });
    if (search) qb.andWhere('c.name ILIKE :search', { search: `%${search}%` });
    const rawData = await qb.orderBy('c.name', 'ASC').getMany();
    return {
      data: rawData,
      message: 'Category list retrieved successfully',
    };
  }

  async findOne(id: string, shopId: string) {
    const c = await this.categories.findOne({ where: { id, shopId }, relations: ['parent', 'children'] });
    if (!c) throw new NotFoundException('Category not found');
    return c;
  }

  async create(dto: CreateCategoryDto, shopId: string) {
    const category = this.categories.create({ ...dto, shopId });
    if (dto.parentId) {
      const parent = await this.categories.findOne({ where: { id: dto.parentId, shopId } });
      if (parent) category.parent = parent;
    }
    return {
      data: await this.categories.save(category),
      message: 'Category created successfully',
    };
  }

  async update(id: string, dto: UpdateCategoryDto, shopId: string) {
    const c = await this.findOne(id, shopId);
    return {
      data: await this.categories.save(Object.assign(c, dto)),
      message: 'Category updated successfully',
    };
  }

  async remove(id: string, shopId: string) {
    await this.findOne(id, shopId);
    await this.categories.softDelete(id);
    return {
      message: 'Category deleted successfully',
    };
  }
}
