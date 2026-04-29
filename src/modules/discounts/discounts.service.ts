import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { buildPaginationMeta } from 'src/common/dto/pagination.dto';
import { Discount, DiscountType } from './entities/discount.entity';
import {
  CreateDiscountDto,
  DiscountFilterDto,
  UpdateDiscountDto,
  ValidateDiscountDto,
} from './dto/discount.dto';

@Injectable()
export class DiscountsService {
  constructor(
    @InjectRepository(Discount)
    private readonly repo: Repository<Discount>,
  ) {}

  async create(dto: CreateDiscountDto, shopId: string) {
    const discount = this.repo.create({
      ...dto,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      shopId,
    });
    const saved = await this.repo.save(discount);
    return { data: saved, message: 'Discount created successfully' };
  }

  async findAll(shopId: string, filters: DiscountFilterDto) {
    const { search, isActive, page = 1, limit = 20 } = filters;

    const qb = this.repo
      .createQueryBuilder('d')
      .where('d.shopId = :shopId', { shopId });

    if (search) {
      qb.andWhere('(d.name ILIKE :search OR d.code ILIKE :search)', {
        search: `%${search}%`,
      });
    }
    if (isActive !== undefined) qb.andWhere('d.isActive = :isActive', { isActive });

    const total = await qb.getCount();
    const data = await qb
      .orderBy('d.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      data,
      message: 'Discounts retrieved successfully',
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  async findOne(id: string, shopId: string) {
    const discount = await this.repo.findOne({ where: { id, shopId } });
    if (!discount) throw new NotFoundException('Discount not found');
    return { data: discount, message: 'Discount retrieved successfully' };
  }

  async update(id: string, dto: UpdateDiscountDto, shopId: string) {
    const { data: discount } = await this.findOne(id, shopId);
    const updates: Partial<Discount> = { ...dto } as any;
    if (dto.startsAt !== undefined) updates.startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
    if (dto.expiresAt !== undefined) updates.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    Object.assign(discount, updates);
    const saved = await this.repo.save(discount);
    return { data: saved, message: 'Discount updated successfully' };
  }

  async remove(id: string, shopId: string) {
    await this.findOne(id, shopId);
    await this.repo.softDelete(id);
    return { message: 'Discount deleted successfully' };
  }

  async validateCoupon(dto: ValidateDiscountDto, shopId: string) {
    const discount = await this.repo.findOne({
      where: { code: dto.code, shopId, isActive: true },
    });
    if (!discount) throw new NotFoundException('Invalid coupon code');

    const now = new Date();
    if (discount.startsAt && discount.startsAt > now) {
      throw new BadRequestException('Coupon not yet active');
    }
    if (discount.expiresAt && discount.expiresAt < now) {
      throw new BadRequestException('Coupon has expired');
    }
    if (discount.usageLimit && discount.usageCount >= discount.usageLimit) {
      throw new BadRequestException('Coupon usage limit reached');
    }
    if (discount.minOrderAmount && dto.cartTotal < Number(discount.minOrderAmount)) {
      throw new BadRequestException(`Minimum order amount is ${discount.minOrderAmount}`);
    }

    let amount =
      discount.type === DiscountType.PERCENTAGE
        ? (dto.cartTotal * Number(discount.value)) / 100
        : Number(discount.value);

    if (discount.maxDiscountAmount) {
      amount = Math.min(amount, Number(discount.maxDiscountAmount));
    }

    return { data: { discount, calculatedAmount: amount }, message: 'Coupon is valid' };
  }

  async applyCoupon(id: string, shopId: string) {
    const { data: discount } = await this.findOne(id, shopId);
    discount.usageCount += 1;
    const saved = await this.repo.save(discount);
    return { data: saved, message: 'Coupon applied successfully' };
  }
}
