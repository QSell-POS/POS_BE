import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard, ShopId, Permissions } from 'src/common/guards/auth.guard';
import { Permission } from 'src/common/permissions/permission.enum';
import { UserRole } from 'src/modules/users/entities/user.entity';
import { UuidParamPipe } from 'src/common/validator';
import { TaxService } from './tax.service';
import { CreateTaxRuleDto, TaxFilterDto, UpdateTaxRuleDto } from './dto/tax.dto';

@ApiBearerAuth()
@ApiTags('Tax Rules')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tax')
export class TaxController {
  constructor(private readonly taxService: TaxService) {}

  @Get()
  @Permissions(Permission.TAX_VIEW)
  @ApiOperation({ summary: 'Get all tax rules' })
  findAll(@ShopId() shopId: string, @Query() filters: TaxFilterDto) {
    return this.taxService.findAll(shopId, filters);
  }

  @Get('default')
  @Permissions(Permission.TAX_VIEW)
  @ApiOperation({ summary: 'Get the default tax rule' })
  getDefault(@ShopId() shopId: string) {
    return this.taxService.getDefault(shopId);
  }

  @Get(':id')
  @Permissions(Permission.TAX_VIEW)
  @ApiOperation({ summary: 'Get tax rule by ID' })
  findOne(@Param('id', UuidParamPipe) id: string, @ShopId() shopId: string) {
    return this.taxService.findOne(id, shopId);
  }

  @Post()
  @Permissions(Permission.TAX_MANAGE)
  @ApiOperation({ summary: 'Create a new tax rule' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  create(@Body() dto: CreateTaxRuleDto, @ShopId() shopId: string) {
    return this.taxService.create(dto, shopId);
  }

  @Put(':id')
  @Permissions(Permission.TAX_MANAGE)
  @ApiOperation({ summary: 'Update a tax rule' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  update(
    @Param('id', UuidParamPipe) id: string,
    @Body() dto: UpdateTaxRuleDto,
    @ShopId() shopId: string,
  ) {
    return this.taxService.update(id, dto, shopId);
  }

  @Patch(':id/set-default')
  @Permissions(Permission.TAX_MANAGE)
  @ApiOperation({ summary: 'Set a tax rule as the default' })
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  setDefault(@Param('id', UuidParamPipe) id: string, @ShopId() shopId: string) {
    return this.taxService.setDefault(id, shopId);
  }

  @Delete(':id')
  @Permissions(Permission.TAX_MANAGE)
  @ApiOperation({ summary: 'Delete a tax rule' })
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  remove(@Param('id', UuidParamPipe) id: string, @ShopId() shopId: string) {
    return this.taxService.remove(id, shopId);
  }
}
