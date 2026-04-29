import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard, ShopId } from 'src/common/guards/auth.guard';
import { UserRole } from 'src/modules/users/entities/user.entity';
import { UuidParamPipe } from 'src/common/validator';
import { ShiftsService } from './shifts.service';
import { CloseShiftDto, OpenShiftDto, ShiftFilterDto } from './dto/shift.dto';

@ApiBearerAuth()
@ApiTags('Shifts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Post('open')
  @ApiOperation({ summary: 'Open a new shift' })
  openShift(
    @Body() dto: OpenShiftDto,
    @ShopId() shopId: string,
    @CurrentUser() user: any,
  ) {
    return this.shiftsService.openShift(dto, shopId, user.id);
  }

  @Get('active')
  @ApiOperation({ summary: "Get current user's active shift" })
  getActiveShift(@ShopId() shopId: string, @CurrentUser() user: any) {
    return this.shiftsService.getActiveShift(shopId, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all shifts (Admin/Manager only)' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  findAll(@ShopId() shopId: string, @Query() filters: ShiftFilterDto) {
    return this.shiftsService.findAll(shopId, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get shift by ID' })
  findOne(@Param('id', UuidParamPipe) id: string, @ShopId() shopId: string) {
    return this.shiftsService.findOne(id, shopId);
  }

  @Post(':id/close')
  @ApiOperation({ summary: 'Close an open shift' })
  closeShift(
    @Param('id', UuidParamPipe) id: string,
    @Body() dto: CloseShiftDto,
    @ShopId() shopId: string,
    @CurrentUser() user: any,
  ) {
    return this.shiftsService.closeShift(id, dto, shopId, user.id);
  }
}
