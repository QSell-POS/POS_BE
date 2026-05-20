import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtAuthGuard, Permissions, RolesGuard } from 'src/common/guards/auth.guard';
import { Permission } from 'src/common/permissions/permission.enum';
import { CatalogService } from './catalog.service';
import {
  BulkImportDto,
  CatalogFilterDto,
  CreateCatalogProductDto,
  ImportCatalogProductDto,
  LinkProductToCatalogDto,
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

  // ── Static routes first (must be before :id) ─────────────────────────────────

  @Get()
  @Permissions(Permission.CATALOG_VIEW)
  @ApiOperation({ summary: 'Get catalog products (default: approved, pass ?status=pending for suggestions)' })
  findAll(@Query() filters: CatalogFilterDto) {
    return this.catalogService.findAll(filters);
  }

  @Get('unlinked')
  @Permissions(Permission.CATALOG_MANAGE)
  @ApiOperation({ summary: 'List all shop products not linked to any catalog product (super admin)' })
  getUnlinkedProducts(
    @Query('search') search: string,
    @Query('page') page: number,
    @Query('limit') limit: number,
  ) {
    return this.catalogService.getUnlinkedProducts({ search, page, limit });
  }

  @Patch('link-product')
  @Permissions(Permission.CATALOG_MANAGE)
  @ApiOperation({ summary: 'Manually link a shop product to a catalog product (super admin)' })
  linkProductToCatalog(@Body() dto: LinkProductToCatalogDto) {
    return this.catalogService.linkProductToCatalog(dto.productId, dto.catalogProductId);
  }

  @Get('similar')
  @Permissions(Permission.CATALOG_VIEW)
  @ApiOperation({ summary: 'Find similar approved catalog products by name' })
  getSimilar(@Query('name') name: string) {
    return this.catalogService.getSimilar(name);
  }

  @Get('shop/products')
  @Permissions(Permission.CATALOG_VIEW)
  @ApiOperation({ summary: 'Get list of catalog products imported to this shop' })
  getShopProducts(@CurrentUser() user: any) {
    return this.catalogService.getShopProducts(user.shopId);
  }

  @Post()
  @Permissions(Permission.CATALOG_MANAGE)
  @ApiOperation({ summary: 'Create a catalog product (super admin)' })
  create(@Body() dto: CreateCatalogProductDto, @CurrentUser() user: any) {
    return this.catalogService.create(dto, user.id);
  }

  @Post('suggest')
  @Permissions(Permission.CATALOG_SUGGEST)
  @ApiOperation({ summary: 'Suggest a new product to be added to the catalog' })
  suggest(@Body() dto: SuggestCatalogProductDto, @CurrentUser() user: any) {
    return this.catalogService.suggest(dto, user.id);
  }

  @Get('onboarding')
  @Permissions(Permission.CATALOG_VIEW)
  @ApiOperation({ summary: 'Get catalog products grouped by category for a given shopType (onboarding)' })
  getOnboardingProducts(@Query('shopType') shopType: string) {
    return this.catalogService.getOnboardingProducts(shopType);
  }

  @Post('import')
  @Permissions(Permission.CATALOG_VIEW)
  @ApiOperation({ summary: 'Import a single catalog product into your shop inventory' })
  importToShop(@Body() dto: ImportCatalogProductDto, @CurrentUser() user: any) {
    return this.catalogService.importToShop(dto, user.shopId, user.id);
  }

  @Post('import/bulk')
  @Permissions(Permission.CATALOG_VIEW)
  @ApiOperation({ summary: 'Bulk import catalog products into your shop (used during onboarding)' })
  bulkImport(@Body() dto: BulkImportDto, @CurrentUser() user: any) {
    return this.catalogService.bulkImport(dto.catalogProductIds, user.shopId, user.id);
  }

  @Post('onboarding/complete')
  @Permissions(Permission.CATALOG_VIEW)
  @ApiOperation({ summary: 'Mark onboarding as completed for this shop' })
  completeOnboarding(@CurrentUser() user: any) {
    return this.catalogService.completeOnboarding(user.shopId);
  }

  // ── Parameterized routes ──────────────────────────────────────────────────────

  @Get(':id')
  @Permissions(Permission.CATALOG_VIEW)
  @ApiOperation({ summary: 'Get a catalog product by ID' })
  async findOne(@Param('id') id: string) {
    return { data: await this.catalogService.findOne(id) };
  }

  @Put(':id')
  @Permissions(Permission.CATALOG_MANAGE)
  @ApiOperation({ summary: 'Update a catalog product (super admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateCatalogProductDto) {
    return this.catalogService.update(id, dto);
  }

  @Patch(':id/review')
  @Permissions(Permission.CATALOG_REVIEW)
  @ApiOperation({ summary: 'Approve or reject a suggested catalog product (super admin)' })
  review(@Param('id') id: string, @Body() dto: ReviewCatalogProductDto, @CurrentUser() user: any) {
    return this.catalogService.review(id, dto, user.id);
  }

  @Patch(':id/link')
  @Permissions(Permission.CATALOG_REVIEW)
  @ApiOperation({ summary: 'Link a pending suggestion to an existing catalog product instead of approving it as new' })
  linkSuggestion(@Param('id') id: string, @Body() dto: LinkSuggestionDto) {
    return this.catalogService.linkSuggestion(id, dto.catalogProductId);
  }

  @Get(':id/sales-stats')
  @Permissions(Permission.CATALOG_VIEW)
  @ApiOperation({ summary: 'Get cross-shop sales stats for a catalog product' })
  getSalesStats(@Param('id') id: string) {
    return this.catalogService.getCatalogProductSalesStats(id);
  }
}
