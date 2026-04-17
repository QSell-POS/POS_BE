import { Repository } from "typeorm";
import { UpdateShopDto } from "./shop.dto";
import { Shop } from "src/entities/shop.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { Injectable, NotFoundException } from "@nestjs/common";

@Injectable()
export class ShopService {
  constructor(
    @InjectRepository(Shop)
    private shops: Repository<Shop>,
  ) {}

  async fetch(params: any) {
    return this.shops.find({
      where: params,
    });
  }

  async fetchOne(id: string) {
    const shop = await this.shops.findOne({ where: { id } });
    if (!shop) throw new NotFoundException("Shop not found");

    return shop;
  }

  async create(data: Partial<Shop>) {
    const shop = this.shops.create(data);
    return this.shops.save(shop);
  }

  async update(id: string, data: UpdateShopDto) {
    const shop = await this.shops.update(id, data);
    console.log(shop);
    if (shop.affected === 0) {
      throw new NotFoundException("Shop not found");
    }
    return { message: "Shop updated successfully" };
  }

  async delete(id: string) {
    const shop = await this.shops.findOne({ where: { id } });
    if (!shop) throw new NotFoundException("Shop not found");

    return this.shops.remove(shop);
  }
}
