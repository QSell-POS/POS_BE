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
import { BrandService } from "./brand.service";
import { UuidParamPipe } from "src/common/validator";
import { BrandDto, BrandUpdateDto } from "./brand.dto";

@Controller("brand")
export class BrandController {
  constructor(private readonly brandService: BrandService) {}

  @Get()
  @UseGuards(AuthGuard("jwt"))
  fetch(@Req() req) {
    return this.brandService.fetch({ shop: { id: req.user.shopId } });
  }

  @Get(":id")
  @UseGuards(AuthGuard("jwt"))
  fetchOne(@Param("id", UuidParamPipe) id: string) {
    return this.brandService.fetchOne(id);
  }

  @Post()
  @UseGuards(AuthGuard("jwt"))
  create(@Body() data: BrandDto) {
    return this.brandService.create(data);
  }

  @Patch(":id")
  @UseGuards(AuthGuard("jwt"))
  async update(
    @Param("id", UuidParamPipe) id: string,
    @Body() body: BrandUpdateDto,
  ) {
    return this.brandService.update(id, body);
  }

  @Delete(":id")
  @UseGuards(AuthGuard("jwt"))
  async delete(@Param("id", UuidParamPipe) id: string) {
    return this.brandService.delete(id);
  }
}
