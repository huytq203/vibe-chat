import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { databaseConfig } from './config/database.config';
import { envValidationSchema } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env'],
      load: [databaseConfig],
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false, allowUnknown: true },
    }),
    // Rate limit toàn cục — default 10 req/s/IP, override theo từng endpoint với @Throttle
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'default', ttl: 1000, limit: 10 },
        { name: 'auth', ttl: 60_000, limit: 5 }, // 5 req/phút cho login/register
      ],
    }),
    PrismaModule,
    DatabaseModule,
    UsersModule,
    AuthModule,
  ],
  controllers: [],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
