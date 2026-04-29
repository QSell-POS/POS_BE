import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { buildPaginationMeta } from 'src/common/dto/pagination.dto';
import { Shift, ShiftStatus } from './entities/shift.entity';
import { CloseShiftDto, OpenShiftDto, ShiftFilterDto } from './dto/shift.dto';

@Injectable()
export class ShiftsService {
  constructor(
    @InjectRepository(Shift)
    private readonly repo: Repository<Shift>,
  ) {}

  async openShift(dto: OpenShiftDto, shopId: string, userId: string) {
    const existing = await this.repo.findOne({
      where: { openedBy: userId, shopId, status: ShiftStatus.OPEN },
    });
    if (existing) throw new BadRequestException('You already have an open shift');

    const shift = this.repo.create({
      ...dto,
      openedBy: userId,
      shopId,
      openedAt: new Date(),
      status: ShiftStatus.OPEN,
    });
    const saved = await this.repo.save(shift);
    return { data: saved, message: 'Shift opened successfully' };
  }

  async closeShift(shiftId: string, dto: CloseShiftDto, shopId: string, userId: string) {
    const shift = await this.repo.findOne({
      where: { id: shiftId, shopId, status: ShiftStatus.OPEN },
    });
    if (!shift) throw new NotFoundException('Open shift not found');

    const cashDifference =
      dto.closingCash - Number(shift.totalCashSales) - Number(shift.openingCash);

    Object.assign(shift, {
      ...dto,
      closedBy: userId,
      closedAt: new Date(),
      status: ShiftStatus.CLOSED,
      cashDifference,
    });

    const saved = await this.repo.save(shift);
    return { data: saved, message: 'Shift closed successfully' };
  }

  async getActiveShift(shopId: string, userId: string) {
    const shift = await this.repo.findOne({
      where: { openedBy: userId, shopId, status: ShiftStatus.OPEN },
    });
    return { data: shift || null, message: 'Active shift retrieved' };
  }

  async findAll(shopId: string, filters: ShiftFilterDto) {
    const { status, startDate, endDate, page = 1, limit = 20 } = filters;

    const qb = this.repo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.openedByUser', 'openedByUser')
      .leftJoinAndSelect('s.closedByUser', 'closedByUser')
      .where('s.shopId = :shopId', { shopId });

    if (status) qb.andWhere('s.status = :status', { status });
    if (startDate) qb.andWhere('s.openedAt >= :startDate', { startDate });
    if (endDate) qb.andWhere('s.openedAt <= :endDate', { endDate });

    const total = await qb.getCount();
    const data = await qb
      .orderBy('s.openedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      data,
      message: 'Shifts retrieved successfully',
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  async findOne(id: string, shopId: string) {
    const shift = await this.repo.findOne({
      where: { id, shopId },
      relations: ['openedByUser', 'closedByUser'],
    });
    if (!shift) throw new NotFoundException('Shift not found');
    return { data: shift, message: 'Shift retrieved successfully' };
  }
}
