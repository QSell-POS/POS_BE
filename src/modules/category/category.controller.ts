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
import { CategoryService } from "./category.service";
import { UuidParamPipe } from "src/common/validator";
import { CategoryDto, CategoryUpdateDto } from "./category.dto";

@Controller("category")
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @UseGuards(AuthGuard("jwt"))
  fetch(@Req() req) {
    return this.categoryService.fetch({ shop: { id: req.user.shopId } });
  }

  @Get(":id")
  @UseGuards(AuthGuard("jwt"))
  fetchOne(@Param("id", UuidParamPipe) id: string) {
    return this.categoryService.fetchOne(id);
  }

  @Post()
  @UseGuards(AuthGuard("jwt"))
  create(@Body() data: CategoryDto) {
    return this.categoryService.create(data);
  }

  @Patch(":id")
  @UseGuards(AuthGuard("jwt"))
  async update(
    @Param("id", UuidParamPipe) id: string,
    @Body() body: CategoryUpdateDto,
  ) {
    return this.categoryService.update(id, body);
  }

  @Delete(":id")
  @UseGuards(AuthGuard("jwt"))
  async delete(@Param("id", UuidParamPipe) id: string) {
    return this.categoryService.delete(id);
  }
}
