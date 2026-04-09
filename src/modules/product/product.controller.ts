import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { ProductService } from "./product.service";
import { AuthGuard } from "@nestjs/passport";
import { ProductDto } from "./product.dto";

@Controller("product")
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  getProducts() {
    return {
      message: "Product API working 🚀",
      data: [],
    };
  }

  @Post("")
  @UseGuards(AuthGuard("jwt"))
  createProduct(@Body() body: ProductDto, @Req() req: any) {
    return this.productService.create(body);
  }
}
