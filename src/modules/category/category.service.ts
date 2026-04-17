import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Category } from "src/entities/category.entity";
import { Repository } from "typeorm";
import { CategoryUpdateDto } from "./category.dto";

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(Category)
    private categories: Repository<Category>,
  ) {}

  async fetch(params: any) {
    return this.categories.find({
      where: params,
    });
  }

  async fetchOne(id: string) {
    const category = await this.categories.findOne({
      where: { id },
      relations: ["shop"],
    });
    if (!category) throw new NotFoundException("Category not found");

    return category;
  }

  async create(data: Partial<Category>) {
    try {
      const category = this.categories.create(data);
      return await this.categories.save(category);
    } catch (error: any) {
      if (error.code === "23503") {
        throw new BadRequestException("Shop does not exist");
      }
      if (error.code === "23505") {
        throw new ConflictException("Category already exists in this shop");
      }
      throw error;
    }
  }

  async update(id: string, data: CategoryUpdateDto) {
    const brand = await this.categories.update(id, data);
    if (brand.affected === 0) {
      throw new NotFoundException("Category not found");
    }
    return { message: "Category updated successfully" };
  }

  async delete(id: string) {
    const brand = await this.categories.findOne({ where: { id } });
    if (!brand) throw new NotFoundException("Category not found");

    return this.categories.remove(brand);
  }
}
