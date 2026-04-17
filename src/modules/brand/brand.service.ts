import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";

import { Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { Brand } from "src/entities/brand.entity";
import { BrandUpdateDto } from "./brand.dto";

@Injectable()
export class BrandService {
  constructor(
    @InjectRepository(Brand)
    private brands: Repository<Brand>,
  ) {}

  async fetch(params: any) {
    return this.brands.find({
      where: params,
    });
  }

  async fetchOne(id: string) {
    const brand = await this.brands.findOne({
      where: { id },
      relations: ["shop"],
    });
    if (!brand) throw new NotFoundException("Brand not found");

    return brand;
  }

  async create(data: Partial<Brand>) {
    try {
      const brand = this.brands.create(data);
      return await this.brands.save(brand);
    } catch (error: any) {
      if (error.code === "23503") {
        throw new BadRequestException("Shop does not exist");
      }
      if (error.code === "23505") {
        throw new ConflictException("Brand already exists in this shop");
      }
      throw error;
    }
  }

  async update(id: string, data: BrandUpdateDto) {
    const brand = await this.brands.update(id, data);
    if (brand.affected === 0) {
      throw new NotFoundException("Brand not found");
    }
    return { message: "Brand updated successfully" };
  }

  async delete(id: string) {
    const brand = await this.brands.findOne({ where: { id } });
    if (!brand) throw new NotFoundException("Brand not found");

    return this.brands.remove(brand);
  }
}
