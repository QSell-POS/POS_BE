import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Product } from "src/entities/product.entity";
import { Repository } from "typeorm";
import { ProductDto } from "./product.dto";

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private products: Repository<Product>,
  ) {}

  async create(data: ProductDto) {
    const product = this.products.create(data);
    return this.products.save(product);
  }
}
