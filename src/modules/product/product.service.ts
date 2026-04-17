import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";

import { InjectRepository } from "@nestjs/typeorm";
import { Shop } from "src/entities/shop.entity";
import { Product } from "src/entities/product.entity";
import { Repository } from "typeorm";
import { ProductDto } from "./product.dto";

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Shop)
    private shops: Repository<Shop>,
    @InjectRepository(Product)
    private products: Repository<Product>,
  ) {}

  async getProducts() {
    return this.products.find();
  }

  async getProductById(id: string) {
    const product = await this.products.findOne({
      where: { id },
      relations: ["shop", "brand", "category"],
    });
    if (!product) throw new NotFoundException("Product not found");

    return product;
  }

  async create(data: ProductDto) {
    try {
      const shop = await this.shops.findOne({
        where: { id: data.shopId },
      });

      if (!shop) {
        throw new BadRequestException("Shop does not exist");
      }

      const product = this.products.create(data);
      return await this.products.save(product);
    } catch (error: any) {
      if (error.code === "23503") {
        throw new BadRequestException("Shop does not exist");
      }

      if (error.code === "23505") {
        throw new ConflictException(error.detail);
      }
      throw error;
    }
  }

  async deleteProduct(id: string) {
    try {
      const result = await this.products.softDelete(id);
      if (result.affected === 0) {
        throw new NotFoundException("Product not found");
      }
      return {
        message: "Product deleted successfully",
      };
    } catch (error) {
      throw error;
    }
  }
}
