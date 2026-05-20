import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtAuthGuard, Permissions, RolesGuard } from 'src/common/guards/auth.guard';
import { Permission } from 'src/common/permissions/permission.enum';
import { CatalogService } from './catalog.service';
import {
  CatalogFilterDto,
  CreateCatalogProductDto,
  ImportCatalogProductDto,
  LinkSuggestionDto,
  ReviewCatalogProductDto,
  SuggestCatalogProductDto,
  UpdateCatalogProductDto,
} from './dto/catalog.dto';

@ApiTags('Catalog')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  @Permissions(Permission.CATALOG_VIEW)
  @ApiOperation({ summary: 'Get all approved catalog products' })
  findAll(@Query() filters: CatalogFilterDto) {
    return this.catalogService.findAll(filters);
  }

  @Get(':id')
  @Permissions(Permission.CATALOG_VIEW)
  @ApiOperation({ summary: 'Get a catalog product by ID' })
  async findOne(@Param('id') id: string) {
    return { data: await this.catalogService.findOne(id) };
  }

  @Post()
  @Permissions(Permission.CATALOG_MANAGE)
  @ApiOperation({ summary: 'Create a catalog product (super admin)' })
  create(@Body() dto: CreateCatalogProductDto, @CurrentUser() user: any) {
    return this.catalogService.create(dto, user.id);
  }

  @Put(':id')
  @Permissions(Permission.CATALOG_MANAGE)
  @ApiOperation({ summary: 'Update a catalog product (super admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateCatalogProductDto) {
    return this.catalogService.update(id, dto);
  }

  @Post('suggest')
  @Permissions(Permission.CATALOG_SUGGEST)
  @ApiOperation({ summary: 'Suggest a new product to be added to the catalog' })
  suggest(@Body() dto: SuggestCatalogProductDto, @CurrentUser() user: any) {
    return this.catalogService.suggest(dto, user.id);
  }

  @Patch(':id/review')
  @Permissions(Permission.CATALOG_REVIEW)
  @ApiOperation({ summary: 'Approve or reject a suggested catalog product (super admin)' })
  review(@Param('id') id: string, @Body() dto: ReviewCatalogProductDto, @CurrentUser() user: any) {
    return this.catalogService.review(id, dto, user.id);
  }

  @Get('similar')
  @Permissions(Permission.CATALOG_VIEW)
  @ApiOperation({ summary: 'Find similar approved catalog products by name' })
  getSimilar(@Query('name') name: string) {
    return this.catalogService.getSimilar(name);
  }

  @Patch(':id/link')
  @Permissions(Permission.CATALOG_REVIEW)
  @ApiOperation({ summary: 'Link a pending suggestion to an existing catalog product instead of approving it as new' })
  linkSuggestion(@Param('id') id: string, @Body() dto: LinkSuggestionDto) {
    return this.catalogService.linkSuggestion(id, dto.catalogProductId);
  }

  @Post('import')
  @Permissions(Permission.CATALOG_VIEW)
  @ApiOperation({ summary: 'Import a catalog product into your shop inventory' })
  importToShop(@Body() dto: ImportCatalogProductDto, @CurrentUser() user: any) {
    return this.catalogService.importToShop(dto, user.shopId, user.id);
  }

  @Get('shop/products')
  @Permissions(Permission.CATALOG_VIEW)
  @ApiOperation({ summary: 'Get list of catalog products imported to this shop' })
  getShopProducts(@CurrentUser() user: any) {
    return this.catalogService.getShopProducts(user.shopId);
  }

  @Get(':id/sales-stats')
  @Permissions(Permission.CATALOG_VIEW)
  @ApiOperation({ summary: 'Get cross-shop sales stats for a catalog product' })
  getSalesStats(@Param('id') id: string) {
    return this.catalogService.getCatalogProductSalesStats(id);
  }
}
