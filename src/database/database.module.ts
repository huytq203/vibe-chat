import { Module, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseConfig } from '@/config/database.config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const db = configService.getOrThrow<DatabaseConfig>('database');
        const isProd = configService.get<string>('NODE_ENV') === 'production';

        Logger.log(
          `Connecting MySQL/TiDB at ${db.host}:${db.port}/${db.database} (ssl=${db.ssl})`,
          'DatabaseModule',
        );

        return {
          type: 'mysql',
          host: db.host,
          port: db.port,
          username: db.username,
          password: db.password,
          database: db.database,
          // TiDB Cloud bắt buộc TLS. mysql2 sẽ dùng CA của hệ thống khi truyền object {} rỗng.
          ssl: db.ssl
            ? {
                minVersion: 'TLSv1.2',
                rejectUnauthorized: db.sslRejectUnauthorized,
              }
            : undefined,
          // Pool size — mysql2 dùng `connectionLimit` qua extra
          extra: {
            connectionLimit: db.poolSize,
            connectTimeout: db.connectTimeoutMs,
            // TiDB không hỗ trợ một số session var của MySQL — để default là an toàn
          },
          // Auto-load entities khai báo qua TypeOrmModule.forFeature() trong từng module
          autoLoadEntities: true,
          // KHÔNG bao giờ true ở prod — dùng migration
          synchronize: !isProd && db.synchronize,
          migrationsRun: false,
          migrations: ['dist/database/migrations/*.js'],
          logging: db.logging ? ['query', 'error', 'warn'] : ['error'],
          // Charset đồng bộ với schema.sql
          charset: 'utf8mb4_0900_ai_ci',
          timezone: 'Z',
          retryAttempts: isProd ? 10 : 3,
          retryDelay: 3000,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
