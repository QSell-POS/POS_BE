import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StockTransfer, StockTransferItem, TransferStatus } from './entities/stock-transfer.entity';
import { CreateStockTransferDto, ReceiveTransferDto, StockTransferFilterDto } from './dto/stock-transfer.dto';
import { buildPaginationMeta } from 'src/common/dto/pagination.dto';
import { InventoryService } from '../inventory/inventory.service';
import { InventoryMovementType } from '../inventory/entities/inventory-history.entity';

@Injectable()
export class StockTransferService {
  constructor(
    @InjectRepository(StockTransfer)
    private readonly repo: Repository<StockTransfer>,
    @InjectRepository(StockTransferItem)
    private readonly itemRepo: Repository<StockTransferItem>,
    private readonly inventoryService: InventoryService,
  ) {}

  async create(dto: CreateStockTransferDto, fromShopId: string, userId: string) {
    if (dto.toShopId === fromShopId) {
      throw new BadRequestException('Source and destination shops cannot be the same');
    }

    for (const item of dto.items) {
      const inv = await this.inventoryService.getInventoryByProduct(item.productId, fromShopId).catch(() => null);
      const available = inv ? Number(inv.quantityAvailable) : 0;
      if (available < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for product ${item.productId}. Available: ${available}, requested: ${item.quantity}`,
        );
      }
    }

    const ref = `TRF-${Date.now()}`;
    const transfer = this.repo.create({
      fromShopId,
      toShopId: dto.toShopId,
      referenceNumber: ref,
      transferredBy: userId,
      notes: dto.notes,
      status: TransferStatus.PENDING,
    });
    const saved = await this.repo.save(transfer);

    const items = dto.items.map((i) =>
      this.itemRepo.create({
        transferId: saved.id,
        productId: i.productId,
        quantity: i.quantity,
        notes: i.notes,
      }),
    );
    await this.itemRepo.save(items);

    const result = await this.findOne(saved.id, fromShopId);
    return { data: result.data, message: 'Stock transfer created' };
  }

  async send(id: string, shopId: string, userId: string) {
    const t = await this.repo.findOne({
      where: { id, fromShopId: shopId, status: TransferStatus.PENDING },
      relations: ['items'],
    });
    if (!t) throw new NotFoundException('Transfer not found or not in PENDING status');

    for (const item of t.items) {
      await this.inventoryService.adjustStock(
        {
          productId: item.productId,
          quantity: Number(item.quantity),
          movementType: InventoryMovementType.TRANSFER_OUT,
          referenceId: t.referenceNumber,
          referenceType: 'stock_transfer',
          notes: `Transfer ${t.referenceNumber} to shop ${t.toShopId}`,
          performedBy: userId,
        },
        shopId,
      );
    }

    await this.repo.update(id, { status: TransferStatus.IN_TRANSIT, sentAt: new Date() });
    return { data: null, message: 'Transfer sent and stock deducted from source shop' };
  }

  async receive(id: string, dto: ReceiveTransferDto, toShopId: string, userId: string) {
    const t = await this.repo.findOne({
      where: { id, toShopId, status: TransferStatus.IN_TRANSIT },
      relations: ['items'],
    });
    if (!t) throw new NotFoundException('Transfer not found or not in IN_TRANSIT status');

    for (const recv of dto.items) {
      const item = t.items.find((i) => i.id === recv.transferItemId);
      if (!item) {
        throw new BadRequestException(`Transfer item ${recv.transferItemId} does not belong to this transfer`);
      }
      if (recv.receivedQuantity > Number(item.quantity)) {
        throw new BadRequestException(
          `Received quantity (${recv.receivedQuantity}) exceeds sent quantity (${item.quantity})`,
        );
      }

      await this.itemRepo.update(recv.transferItemId, {
        receivedQuantity: recv.receivedQuantity,
      });

      if (recv.receivedQuantity > 0) {
        await this.inventoryService.adjustStock(
          {
            productId: item.productId,
            quantity: recv.receivedQuantity,
            movementType: InventoryMovementType.TRANSFER_IN,
            referenceId: t.referenceNumber,
            referenceType: 'stock_transfer',
            notes: `Transfer ${t.referenceNumber} from shop ${t.fromShopId}`,
            performedBy: userId,
          },
          toShopId,
        );
      }

      const shortfall = Number(item.quantity) - recv.receivedQuantity;
      if (shortfall > 0) {
        await this.inventoryService.adjustStock(
          {
            productId: item.productId,
            quantity: shortfall,
            movementType: InventoryMovementType.TRANSFER_IN,
            referenceId: t.referenceNumber,
            referenceType: 'stock_transfer_shortfall',
            notes: `Transfer ${t.referenceNumber} shortfall returned to source`,
            performedBy: userId,
          },
          t.fromShopId,
        );
      }
    }

    await this.repo.update(id, {
      status: TransferStatus.RECEIVED,
      receivedAt: new Date(),
      receivedBy: userId,
      ...(dto.notes ? { notes: dto.notes } : {}),
    });

    return { data: null, message: 'Transfer received and stock added to destination shop' };
  }

  async cancel(id: string, shopId: string, userId: string) {
    const t = await this.repo.findOne({
      where: { id, fromShopId: shopId },
      relations: ['items'],
    });
    if (!t) throw new NotFoundException('Transfer not found');

    if (t.status === TransferStatus.RECEIVED) {
      throw new BadRequestException('Cannot cancel a received transfer');
    }
    if (t.status === TransferStatus.CANCELLED) {
      throw new BadRequestException('Transfer is already cancelled');
    }

    if (t.status === TransferStatus.IN_TRANSIT) {
      for (const item of t.items) {
        await this.inventoryService.adjustStock(
          {
            productId: item.productId,
            quantity: Number(item.quantity),
            movementType: InventoryMovementType.TRANSFER_IN,
            referenceId: t.referenceNumber,
            referenceType: 'stock_transfer_cancelled',
            notes: `Transfer ${t.referenceNumber} cancelled, stock returned`,
            performedBy: userId,
          },
          t.fromShopId,
        );
      }
    }

    await this.repo.update(id, { status: TransferStatus.CANCELLED });
    return { data: null, message: 'Transfer cancelled' };
  }

  async findAll(shopId: string, filters: StockTransferFilterDto) {
    const { page = 1, limit = 20, status, startDate, endDate } = filters;

    const qb = this.repo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.items', 'items')
      .where('(t.fromShopId = :shopId OR t.toShopId = :shopId)', { shopId });

    if (status) qb.andWhere('t.status = :status', { status });
    if (startDate) qb.andWhere('t.createdAt >= :startDate', { startDate });
    if (endDate) qb.andWhere('t.createdAt <= :endDate', { endDate });

    const total = await qb.getCount();
    const data = await qb
      .orderBy('t.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      data,
      message: 'Stock transfers retrieved successfully',
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  async findOne(id: string, shopId: string) {
    const t = await this.repo.findOne({
      where: [
        { id, fromShopId: shopId },
        { id, toShopId: shopId },
      ],
      relations: ['items'],
    });
    if (!t) throw new NotFoundException('Transfer not found');
    return { data: t, message: 'Stock transfer retrieved successfully' };
  }
}
