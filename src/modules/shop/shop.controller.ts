import {
  Get,
  Body,
  Post,
  Param,
  Patch,
  UseGuards,
  Controller,
  Delete,
  Req,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ShopService } from "./shop.service";
import { CreateShopDto, UpdateShopDto } from "./shop.dto";

@Controller("shop")
export class ShopController {
  constructor(private readonly shopService: ShopService) {}

  @Post("")
  @UseGuards(AuthGuard("jwt"))
  async create(@Body() body: CreateShopDto, @Req() req: any) {
    return this.shopService.create({ ...body, ownerId: req.user.userId });
  }

  @Get("")
  @UseGuards(AuthGuard("jwt"))
  async getAll(@Body() body: any) {
    return this.shopService.fetch(body);
  }

  @Get(":id")
  @UseGuards(AuthGuard("jwt"))
  async getOne(@Param("id") id: string) {
    return this.shopService.fetchOne(id);
  }

  @Patch(":id")
  @UseGuards(AuthGuard("jwt"))
  async update(@Param("id") id: string, @Body() body: UpdateShopDto) {
    return this.shopService.update(id, body);
  }

  @Delete(":id")
  @UseGuards(AuthGuard("jwt"))
  async delete(@Param("id") id: string) {
    return this.shopService.delete(id);
  }
}
