# Exception Pattern

## Vai trò

> Filter là **last line of defense** — bắt mọi exception còn sót, chuẩn hoá thành response envelope.

## Global Exception Filter

```ts
// common/filters/all-exceptions.filter.ts
import {
  ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const { status, payload } = this.normalize(exception);

    // Log
    if (status >= 500) {
      this.logger.error(
        `${req.method} ${req.originalUrl} → ${status} ${payload.code}`,
        (exception as Error)?.stack,
        { requestId: (req as any).id },
      );
    } else {
      this.logger.warn(
        `${req.method} ${req.originalUrl} → ${status} ${payload.code}: ${payload.message}`,
        { requestId: (req as any).id },
      );
    }

    res.status(status).json({
      success: false,
      error: payload,
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      requestId: (req as any).id,
    });
  }

  private normalize(exception: unknown): { status: number; payload: ErrorPayload } {
    // 1. HttpException của Nest
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();

      if (typeof response === 'string') {
        return { status, payload: { code: this.codeFromStatus(status), message: response } };
      }
      if (typeof response === 'object' && response !== null) {
        const body = response as Record<string, unknown>;
        return {
          status,
          payload: {
            code: (body.code as string) ?? this.codeFromStatus(status),
            message: (body.message as string) ?? exception.message,
            details: body.details,
          },
        };
      }
    }

    // 2. Lỗi không xác định
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      payload: {
        code: 'INTERNAL_ERROR',
        message: 'Đã xảy ra lỗi hệ thống, vui lòng thử lại sau',
      },
    };
  }

  private codeFromStatus(status: number): string {
    const map: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_ERROR',
      503: 'SERVICE_UNAVAILABLE',
    };
    return map[status] ?? 'UNKNOWN_ERROR';
  }
}
```

## Validation Exception (custom factory)

```ts
// main.ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) => {
      const details = errors.map((e) => ({
        field: e.property,
        issue: Object.values(e.constraints ?? {})[0] ?? 'invalid',
      }));
      return new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Dữ liệu không hợp lệ',
        details,
      });
    },
  }),
);
```

## Custom Business Exception

```ts
// common/exceptions/business.exception.ts
import { HttpException, HttpStatus } from '@nestjs/common';

export class BusinessException extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: HttpStatus = HttpStatus.UNPROCESSABLE_ENTITY,
    details?: unknown,
  ) {
    super({ code, message, details }, status);
  }
}

// Usage
throw new BusinessException(
  'MESSAGE_TOO_LONG',
  'Tin nhắn vượt giới hạn 5000 ký tự',
);
```

## Domain-specific exception

```ts
// modules/auth/exceptions/auth.exception.ts
export class AuthExceptions {
  static invalidCredentials() {
    return new UnauthorizedException({
      code: 'AUTH_INVALID_CREDENTIALS',
      message: 'Email hoặc mật khẩu không đúng',
    });
  }
  static tokenExpired() {
    return new UnauthorizedException({
      code: 'AUTH_TOKEN_EXPIRED',
      message: 'Phiên đăng nhập đã hết hạn',
    });
  }
  static accountLocked() {
    return new UnauthorizedException({
      code: 'AUTH_ACCOUNT_LOCKED',
      message: 'Tài khoản đã bị khoá',
    });
  }
}

// Usage
throw AuthExceptions.invalidCredentials();
```

## Error code registry

```ts
// common/constants/error-codes.ts
export const ErrorCodes = {
  // Common
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',

  // Auth
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',

  // User
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_EMAIL_TAKEN: 'USER_EMAIL_TAKEN',

  // Message
  MESSAGE_NOT_FOUND: 'MESSAGE_NOT_FOUND',
  MESSAGE_NOT_OWNED: 'MESSAGE_NOT_OWNED',
  MESSAGE_TOO_LONG: 'MESSAGE_TOO_LONG',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
```

## Đăng ký global

```ts
// main.ts
app.useGlobalFilters(new AllExceptionsFilter());
```

## Quy tắc

1. **1 filter global** bắt mọi exception. KHÔNG nhiều filter chồng chéo.
2. **Code string cố định** — không đổi sau khi FE đã sử dụng.
3. **Message tiếng Việt** thân thiện, không lộ kỹ thuật.
4. **Log 5xx full stack**, 4xx warn ngắn.
5. **Không catch Error rồi return null** — để filter handle.

## Anti-pattern

| ❌ Sai | ✅ Đúng |
|---|---|
| Mỗi controller có try/catch | Để global filter xử lý |
| Trả 200 với `{ success: false }` | Trả đúng status code 4xx/5xx |
| `throw new Error('...')` | `throw new BusinessException(...)` |
| Lộ `err.message` từ DB driver | Map sang message thân thiện |
| Code string trùng nhau giữa các domain | Tổng hợp ở `error-codes.ts` |
