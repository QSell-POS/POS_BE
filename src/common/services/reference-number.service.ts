import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface ReferenceConfig {
  /** Table name in the database, e.g. 'sales', 'purchases' */
  table: string;
  /** Column used as shop scope, defaults to 'shop_id' */
  shopColumn?: string;
  /** Restrict count to the current calendar day using this date column */
  dayColumn?: string;
  /** Zero-pad width for the counter part, defaults to 5 */
  padWidth?: number;
}

@Injectable()
export class ReferenceNumberService {
  constructor(private readonly dataSource: DataSource) {}

  async generate(prefix: string, shopId: string, config: ReferenceConfig): Promise<string> {
    const {
      table,
      shopColumn = 'shop_id',
      dayColumn,
      padWidth = 5,
    } = config;

    const date = new Date();
    const yyyymmdd = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('');

    let count: number;

    if (dayColumn) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      const result = await this.dataSource
        .createQueryBuilder()
        .select('COUNT(*)', 'cnt')
        .from(table, 't')
        .where(`t.${shopColumn} = :shopId`, { shopId })
        .andWhere(`t.${dayColumn} BETWEEN :start AND :end`, { start, end })
        .getRawOne<{ cnt: string }>();
      count = parseInt(result.cnt, 10);
    } else {
      const result = await this.dataSource
        .createQueryBuilder()
        .select('COUNT(*)', 'cnt')
        .from(table, 't')
        .where(`t.${shopColumn} = :shopId`, { shopId })
        .getRawOne<{ cnt: string }>();
      count = parseInt(result.cnt, 10);
    }

    return `${prefix}-${yyyymmdd}-${String(count + 1).padStart(padWidth, '0')}`;
  }
}
