import { registerAs } from '@nestjs/config';

export interface DatabaseConfig {
  type: 'mysql';
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  ssl: boolean;
  sslRejectUnauthorized: boolean;
  poolSize: number;
  connectTimeoutMs: number;
  logging: boolean;
  synchronize: boolean;
}

export const databaseConfig = registerAs<DatabaseConfig>('database', () => ({
  type: 'mysql',
  host: process.env.DB_HOST!,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME!,
  password: process.env.DB_PASSWORD!,
  database: process.env.DB_DATABASE!,
  ssl: process.env.DB_SSL === 'true',
  sslRejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
  poolSize: Number(process.env.DB_POOL_SIZE ?? 10),
  connectTimeoutMs: Number(process.env.DB_CONNECT_TIMEOUT_MS ?? 10000),
  logging: process.env.DB_LOGGING === 'true',
  synchronize: process.env.DB_SYNCHRONIZE === 'true',
}));
