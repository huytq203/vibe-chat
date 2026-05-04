# 09 — Logging & Monitoring

## Nguyên tắc

> Log là tài sản. Log đủ để **debug 1 incident lúc 3h sáng** mà không cần đụng vào code. Log không đủ = mù; log quá nhiều = nhiễu.

## 🔴 R-LOG-01: Dùng Logger của Nest, không `console`

```ts
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  async create(dto: CreateUserDto) {
    this.logger.log(`Tạo user mới: ${dto.email}`);
    ...
    this.logger.error('Lỗi khi tạo user', err.stack, { email: dto.email });
  }
}
```

→ Production dùng **Pino** hoặc **Winston** với JSON format. Cấu hình ở `LoggerModule`.

## 🔴 R-LOG-02: Log level

| Level | Khi nào |
|---|---|
| `fatal` | App không thể tiếp tục, exit |
| `error` | Lỗi không xử lý được, cần action |
| `warn` | Bất thường nhưng đã handle (4xx, retry) |
| `info` / `log` | Action quan trọng (login, payment, delete) |
| `debug` | Chi tiết flow, chỉ bật trong dev |
| `verbose` / `trace` | Rất chi tiết, hiếm dùng |

Production log từ `info` trở lên. Dev có thể `debug`.

## 🔴 R-LOG-03: Structured log (JSON)

Mỗi log entry bao gồm:

```jsonc
{
  "timestamp": "2026-05-04T10:00:00.000Z",
  "level": "info",
  "context": "UsersService",
  "message": "Tạo user mới",
  "requestId": "req_abc123",
  "userId": "u_1",
  "ip": "1.2.3.4",
  "duration": 42
}
```

→ Để search được trên ELK/Loki. KHÔNG log dạng `Tạo user thành công với id u_1 ip 1.2.3.4` (text khó parse).

## 🔴 R-LOG-04: Correlation ID / Request ID

- Middleware tạo `requestId` (uuid v4 hoặc nanoid) cho mỗi request.
- Gắn vào `req.id`, response header `X-Request-Id`.
- Mọi log trong scope request bao gồm `requestId` (qua AsyncLocalStorage).

## 🔴 R-LOG-05: Không log thông tin nhạy cảm

❌ Cấm xuất hiện trong log:
- `password`, `passwordHash`, `oldPassword`
- `accessToken`, `refreshToken`, `apiKey`
- `creditCard`, `cvv`, `bankAccount`
- `otp`, `verificationCode`
- Body/header chứa các trường trên — phải mask:

```ts
logger.log('Login attempt', { email, password: '***', ip });
```

→ Setup interceptor mask field theo whitelist.

## 🟡 R-LOG-06: Log lifecycle action chính

Tối thiểu log:
- HTTP request in/out (qua `LoggingInterceptor`): `method, path, status, duration, requestId`.
- Login success / fail.
- Mutation lên resource quan trọng (user, payment).
- Job/cron start/end.
- External API call: `service, endpoint, duration, status`.

## 🟡 R-LOG-07: Health check

- `GET /health` → `200 { status: 'ok', db: 'up', redis: 'up' }`.
- `GET /health/ready` → kiểm DB, cache, queue.
- `GET /health/live` → app còn sống.
- Dùng `@nestjs/terminus`.

## 🟡 R-LOG-08: Metrics

- Expose `/metrics` Prometheus format.
- Metric chuẩn: `http_requests_total`, `http_request_duration_seconds`, `db_query_duration_seconds`.
- Custom metric cho business: `messages_sent_total`, `users_registered_total`.

## 🟡 R-LOG-09: Tracing

- OpenTelemetry SDK. Trace ID lan truyền qua `traceparent` header.
- Span cho mỗi service call, DB query nặng.
- Export sang Jaeger / Tempo.

## 🟢 R-LOG-10: Log sampling

- Khi traffic lớn → sample log `info` (5–10%).
- Lỗi `error/fatal` luôn log 100%.

## Format Logger context

Dùng tên class làm context để filter dễ:

```ts
private readonly logger = new Logger(UsersService.name);
// → context: "UsersService"
```

## Cấm

- ❌ `console.log/error` trong production code.
- ❌ Log password/token kể cả mask không kỹ.
- ❌ Log toàn bộ object lớn (request body 1MB) — log selective.
- ❌ Log trong vòng lặp tight (gây chậm + flood).
- ❌ Stack trace chỉ dạng string concat — dùng `logger.error(msg, err.stack)`.
