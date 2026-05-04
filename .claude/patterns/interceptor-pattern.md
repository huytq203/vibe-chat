# Interceptor Pattern

## Vai trò

> Interceptor bao quanh handler — chạy **trước** (pre) và **sau** (post). Dùng cho: transform response, logging, cache, timeout, retry.

## Transform Interceptor (response envelope)

```ts
// common/interceptors/transform.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
  timestamp: string;
  requestId?: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(ctx: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T>> {
    const req = ctx.switchToHttp().getRequest();
    return next.handle().pipe(
      map((payload: any) => {
        // Service đã trả { data, meta } → giữ nguyên cấu trúc
        const isPaginated = payload && typeof payload === 'object' && 'data' in payload && 'meta' in payload;
        return {
          success: true,
          data: isPaginated ? payload.data : payload,
          meta: isPaginated ? payload.meta : undefined,
          timestamp: new Date().toISOString(),
          requestId: req.id,
        };
      }),
    );
  }
}
```

## Logging Interceptor

```ts
// common/interceptors/logging.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest();
    const { method, originalUrl, ip } = req;
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - start;
          const status = ctx.switchToHttp().getResponse().statusCode;
          this.logger.log(
            `${method} ${originalUrl} ${status} ${duration}ms`,
            { requestId: req.id, ip, userId: req.user?.id },
          );
        },
        error: (err) => {
          const duration = Date.now() - start;
          this.logger.error(
            `${method} ${originalUrl} FAIL ${duration}ms — ${err.message}`,
            err.stack,
            { requestId: req.id },
          );
        },
      }),
    );
  }
}
```

## Timeout Interceptor

```ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler, RequestTimeoutException } from '@nestjs/common';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(private readonly ms = 10_000) {}

  intercept(_: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      timeout(this.ms),
      catchError((err) =>
        err instanceof TimeoutError
          ? throwError(() => new RequestTimeoutException({ code: 'REQUEST_TIMEOUT' }))
          : throwError(() => err),
      ),
    );
  }
}
```

## Cache Interceptor (custom)

```ts
@Injectable()
export class HttpCacheInterceptor extends CacheInterceptor {
  protected trackBy(context: ExecutionContext): string | undefined {
    const req = context.switchToHttp().getRequest();
    if (req.method !== 'GET') return undefined;
    const userId = req.user?.id ?? 'anon';
    return `${userId}:${req.originalUrl}`;
  }
}
```

## Đăng ký global

```ts
// main.ts
app.useGlobalInterceptors(
  new LoggingInterceptor(),
  new TransformInterceptor(),
  new TimeoutInterceptor(15_000),
);
```

## Quy tắc

1. **Order**: Logging (log đầu cuối) → Cache → Transform → Timeout. Đăng ký theo thứ tự.
2. **Không mutate request** trong interceptor — đó là việc của middleware/pipe.
3. **Async với observable** — dùng `pipe(map/tap/catchError)`, không await.
4. **Timeout interceptor** sau cùng để mọi level khác kịp xử.
5. **Test interceptor** với `Reflect.metadata` mock + `lastValueFrom`.

## Anti-pattern

| ❌ Sai | ✅ Đúng |
|---|---|
| Throw business exception trong interceptor | Throw ở service |
| Cache key = full URL có token | Hash hoặc chỉ path + userId |
| Transform mutate object trả về | Tạo object mới rồi return |
| Logging ở mỗi service method | Centralize ở Interceptor |
