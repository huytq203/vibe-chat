import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(configService: ConfigService) {
    const host = configService.getOrThrow<string>('DB_HOST');
    const port = configService.getOrThrow<string>('DB_PORT');
    const username = configService.getOrThrow<string>('DB_USERNAME');
    const password = configService.getOrThrow<string>('DB_PASSWORD');
    const database = configService.getOrThrow<string>('DB_DATABASE');
    const ssl = configService.get<string>('DB_SSL') === 'true';

    const encoded = encodeURIComponent(password);
    // TiDB Cloud / MySQL TLS: Prisma dùng `sslaccept=strict` (verify cert) hoặc `accept_invalid_certs`
    const sslParam = ssl ? '?sslaccept=accept_invalid_certs' : '';
    const datasourceUrl = `mysql://${username}:${encoded}@${host}:${port}/${database}${sslParam}`;

    super({ datasourceUrl });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma connected to MySQL');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Prisma disconnected');
  }
}
