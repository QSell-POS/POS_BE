import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoyaltyTransaction, LoyaltySettings, LoyaltyTransactionType } from './entities/loyalty.entity';
import { Customer } from 'src/modules/sales/entities/customer.entity';
import { UpdateLoyaltySettingsDto, AdjustPointsDto, LoyaltyHistoryFilterDto } from './dto/loyalty.dto';
import { buildPaginationMeta } from 'src/common/dto/pagination.dto';

@Injectable()
export class LoyaltyService {
  constructor(
    @InjectRepository(LoyaltyTransaction)
    private readonly txRepo: Repository<LoyaltyTransaction>,
    @InjectRepository(LoyaltySettings)
    private readonly settingsRepo: Repository<LoyaltySettings>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
  ) {}

  private async getOrCreateSettings(shopId: string): Promise<LoyaltySettings> {
    let settings = await this.settingsRepo.findOne({ where: { shopId } });
    if (!settings) {
      settings = this.settingsRepo.create({ shopId });
      settings = await this.settingsRepo.save(settings);
    }
    return settings;
  }

  async getSettings(shopId: string) {
    const settings = await this.getOrCreateSettings(shopId);
    return { data: settings, message: 'Loyalty settings retrieved successfully' };
  }

  async updateSettings(dto: UpdateLoyaltySettingsDto, shopId: string) {
    const settings = await this.getOrCreateSettings(shopId);
    Object.assign(settings, dto);
    const updated = await this.settingsRepo.save(settings);
    return { data: updated, message: 'Loyalty settings updated successfully' };
  }

  async getCustomerBalance(customerId: string, shopId: string) {
    const customer = await this.customerRepo.findOne({ where: { id: customerId, shopId } });
    if (!customer) throw new NotFoundException('Customer not found');

    const settings = await this.getOrCreateSettings(shopId);
    const points = Number(customer.loyaltyPoints);
    const estimatedValue = points * Number(settings.currencyPerPoint);

    return {
      data: { points, estimatedValue },
      message: 'Customer loyalty balance retrieved successfully',
    };
  }

  async earnPoints(customerId: string, saleTotal: number, saleId: string, shopId: string) {
    const customer = await this.customerRepo.findOne({ where: { id: customerId, shopId } });
    if (!customer) throw new NotFoundException('Customer not found');

    const settings = await this.getOrCreateSettings(shopId);
    if (!settings.isActive) {
      return { data: null, message: 'Loyalty program is not active' };
    }

    const pointsEarned = Math.floor(saleTotal * Number(settings.pointsPerCurrencyUnit));
    if (pointsEarned <= 0) {
      return { data: null, message: 'No points earned for this transaction' };
    }

    const currentBalance = Number(customer.loyaltyPoints);
    const newBalance = currentBalance + pointsEarned;

    await this.customerRepo.update(customerId, { loyaltyPoints: newBalance });

    let expiresAt: Date = null;
    if (settings.pointsExpiryDays) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + settings.pointsExpiryDays);
    }

    const tx = this.txRepo.create({
      shopId,
      customerId,
      transactionType: LoyaltyTransactionType.EARNED,
      points: pointsEarned,
      referenceId: saleId,
      referenceType: 'sale',
      description: `Earned ${pointsEarned} points for sale ${saleId}`,
      balanceAfter: newBalance,
      expiresAt,
    });
    await this.txRepo.save(tx);

    return {
      data: { pointsEarned, newBalance },
      message: `${pointsEarned} points earned successfully`,
    };
  }

  async redeemPoints(customerId: string, points: number, saleId: string, shopId: string) {
    const customer = await this.customerRepo.findOne({ where: { id: customerId, shopId } });
    if (!customer) throw new NotFoundException('Customer not found');

    const settings = await this.getOrCreateSettings(shopId);
    if (!settings.isActive) {
      throw new BadRequestException('Loyalty program is not active');
    }

    const currentBalance = Number(customer.loyaltyPoints);

    if (points < settings.minRedeemPoints) {
      throw new BadRequestException(
        `Minimum ${settings.minRedeemPoints} points required to redeem`,
      );
    }

    if (currentBalance < points) {
      throw new BadRequestException(
        `Insufficient points. Available: ${currentBalance}, requested: ${points}`,
      );
    }

    const newBalance = currentBalance - points;
    const currencyValue = points * Number(settings.currencyPerPoint);

    await this.customerRepo.update(customerId, { loyaltyPoints: newBalance });

    const tx = this.txRepo.create({
      shopId,
      customerId,
      transactionType: LoyaltyTransactionType.REDEEMED,
      points: -points,
      referenceId: saleId,
      referenceType: 'sale',
      description: `Redeemed ${points} points for sale ${saleId}`,
      balanceAfter: newBalance,
    });
    await this.txRepo.save(tx);

    return {
      data: { pointsRedeemed: points, currencyValue, newBalance },
      message: `${points} points redeemed successfully`,
    };
  }

  async adjustPoints(customerId: string, dto: AdjustPointsDto, shopId: string, adminId: string) {
    const customer = await this.customerRepo.findOne({ where: { id: customerId, shopId } });
    if (!customer) throw new NotFoundException('Customer not found');

    const currentBalance = Number(customer.loyaltyPoints);
    const newBalance = currentBalance + dto.points;

    if (newBalance < 0) {
      throw new BadRequestException(
        `Adjustment would result in negative balance. Current: ${currentBalance}`,
      );
    }

    await this.customerRepo.update(customerId, { loyaltyPoints: newBalance });

    const tx = this.txRepo.create({
      shopId,
      customerId,
      transactionType: LoyaltyTransactionType.ADJUSTED,
      points: dto.points,
      referenceId: adminId,
      referenceType: 'user',
      description: dto.description,
      balanceAfter: newBalance,
    });
    await this.txRepo.save(tx);

    return {
      data: { pointsAdjusted: dto.points, newBalance },
      message: 'Points adjusted successfully',
    };
  }

  async getHistory(customerId: string, shopId: string, filters: LoyaltyHistoryFilterDto) {
    const { page = 1, limit = 20, startDate, endDate } = filters;

    const customer = await this.customerRepo.findOne({ where: { id: customerId, shopId } });
    if (!customer) throw new NotFoundException('Customer not found');

    const qb = this.txRepo
      .createQueryBuilder('tx')
      .where('tx.customerId = :customerId', { customerId })
      .andWhere('tx.shopId = :shopId', { shopId });

    if (startDate) qb.andWhere('tx.createdAt >= :startDate', { startDate });
    if (endDate) qb.andWhere('tx.createdAt <= :endDate', { endDate });

    const total = await qb.getCount();
    const data = await qb
      .orderBy('tx.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      data,
      message: 'Loyalty history retrieved successfully',
      meta: buildPaginationMeta(total, page, limit),
    };
  }
}
