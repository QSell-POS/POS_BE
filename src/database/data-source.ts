import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { join } from 'path';
import { register } from 'tsconfig-paths';

dotenv.config();

register({
  baseUrl: join(__dirname, '../../'),
  paths: { 'src/*': ['src/*'] },
});

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  username: process.env.DB_USERNAME || 'pos',
  password: process.env.DB_PASSWORD || 'pos',
  database: process.env.DB_DATABASE || 'posdb',
  entities: [join(__dirname, '../**/*.entity{.ts,.js}')],
  migrations: [join(__dirname, 'migrations/*{.ts,.js}')],
  synchronize: false,
  logging: true,
});
