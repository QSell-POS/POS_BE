import { QueryRunner } from 'typeorm';

export interface ICostingStrategy {
  /**
   * Consume `quantity` units of inventory for `variantId` in `shopId`.
   * Returns the total cost of goods for those units.
   * Must be called inside an active QueryRunner transaction.
   */
  consume(
    variantId: string,
    shopId: string,
    quantity: number,
    queryRunner: QueryRunner,
  ): Promise<number>;
}

export const COSTING_STRATEGY = Symbol('COSTING_STRATEGY');
