import {
  BadRequestException,
  Logger,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationError } from 'class-validator';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ErrorCodes } from './common/constants/error-codes';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

// Global BigInt serializer — Prisma BigInt fields tự convert sang string khi JSON.stringify
// (Mặc định Node throw "Do not know how to serialize a BigInt")
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function (
  this: bigint,
): string {
  return this.toString();
};

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configSvc = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Security middleware — tắt CSP để Swagger UI inline script hoạt động ở dev
  const isProd = configSvc.get<string>('NODE_ENV') === 'production';
  app.use(
    helmet({
      contentSecurityPolicy: isProd ? undefined : false,
      crossOriginEmbedderPolicy: isProd ? undefined : false,
    }),
  );
  app.use(cookieParser());

  // Trust proxy (cần cho req.ip khi sau reverse proxy)
  app.set('trust proxy', 1);

  // Global prefix + versioning — Swagger setup sẽ KHÔNG đi qua prefix này
  const apiPrefix = configSvc.get<string>('API_PREFIX', 'api');
  app.setGlobalPrefix(apiPrefix, {
    exclude: ['/', 'docs', 'docs-json', 'health'],
  });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // Global pipes — validate + transform DTO
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      stopAtFirstError: true,
      exceptionFactory: (errors: ValidationError[]) => {
        // details: { fieldName: "thông báo lỗi đầu tiên" } → FE dùng trực tiếp
        const details: Record<string, string> = {};
        for (const e of errors) {
          const constraints = Object.values(e.constraints ?? {});
          if (constraints.length > 0) {
            details[e.property] = constraints[0];
          }
        }
        return new BadRequestException({
          code: ErrorCodes.VALIDATION_ERROR,
          message: 'Dữ liệu không hợp lệ',
          details,
        });
      },
    }),
  );

  // Global filter — chuẩn hoá error response
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global interceptor — wrap response envelope
  app.useGlobalInterceptors(new TransformInterceptor());

  // CORS
  const originsRaw = configSvc.get<string>('CORS_ORIGINS', '');
  const origins = originsRaw ? originsRaw.split(',').map((o) => o.trim()) : [];
  app.enableCors({
    origin: origins.length ? origins : false,
    credentials: true,
  });

  // Swagger / OpenAPI — chỉ mount ở dev/staging. Path KHÔNG có global prefix.
  if (!isProd) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Vibe Chat API')
      .setDescription('REST API cho ứng dụng chat real-time')
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'access-token',
      )
      .addCookieAuth('refresh_token', {
        type: 'apiKey',
        in: 'cookie',
        name: 'refresh_token',
      })
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
      jsonDocumentUrl: 'docs-json',
    });
    logger.log(
      `Swagger UI:  http://localhost:${configSvc.get('PORT', 3001)}/docs`,
    );
    logger.log(
      `OpenAPI JSON: http://localhost:${configSvc.get('PORT', 3001)}/docs-json`,
    );
  }

  const port = configSvc.get<number>('PORT', 3001);
  await app.listen(port);
  logger.log(
    `Application started on port ${port} [${isProd ? 'production' : 'development'}]`,
  );
}

bootstrap().catch((err: Error) => {
  new Logger('Bootstrap').error('Failed to start application', err.stack);
  process.exit(1);
});
