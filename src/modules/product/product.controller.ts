import {
  Get,
  Req,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Controller,
} from "@nestjs/common";

import { ProductDto } from "./product.dto";
import { AuthGuard } from "@nestjs/passport";
import { ProductService } from "./product.service";
import { UuidParamPipe } from "src/common/validator";

@Controller("product")
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @UseGuards(AuthGuard("jwt"))
  async getProducts() {
    const products = await this.productService.getProducts();
    return {
      message: "Products list retrieved successfully",
      data: products,
    };
  }

  @Get(":id")
  @UseGuards(AuthGuard("jwt"))
  async getProductById(@Param("id", UuidParamPipe) id: string) {
    const product = await this.productService.getProductById(id);
    return {
      message: "Product retrieved successfully",
      data: product,
    };
  }

  @Post("")
  @UseGuards(AuthGuard("jwt"))
  createProduct(@Body() body: ProductDto) {
    return this.productService.create(body);
  }

  @Delete(":id")
  @UseGuards(AuthGuard("jwt"))
  deleteProduct(@Param("id", UuidParamPipe) id: string) {
    return this.productService.deleteProduct(id);
  }
}
