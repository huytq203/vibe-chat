# 05 — Error Handling

## Nguyên tắc

> Lỗi là 1 phần của API contract — phải nhất quán, có code, có log, không lộ chi tiết nội bộ.

## 🔴 R-ERR-01: Dùng exception của Nest, không dùng `Error` thuần

| Tình huống | Exception |
|---|---|
| Validation fail | `BadRequestException` |
| Chưa đăng nhập | `UnauthorizedException` |
| Không đủ quyền | `ForbiddenException` |
| Resource không có | `NotFoundException` |
| Trùng dữ liệu | `ConflictException` |
| Business rule fail | `UnprocessableEntityException` |
| Rate limit | `HttpException(..., 429)` (hoặc `ThrottlerException`) |
| Lỗi không phân loại được | `InternalServerErrorException` |

## 🔴 R-ERR-02: Throw kèm `code` và message tiếng Việt

```ts
throw new NotFoundException({
  code: 'USER_NOT_FOUND',
  message: `Không tìm thấy người dùng với id ${id}`,
});
```

- `code`: theo error-codes.ts (UPPER_SNAKE).
- `message`: tiếng Việt cho user.
- KHÔNG để message lộ thông tin nhạy cảm (DB string, internal path, raw stack).

## 🔴 R-ERR-03: Global Exception Filter

- Đăng ký `AllExceptionsFilter` ở `main.ts`.
- Filter chuẩn hoá mọi exception về response envelope (xem `rules/03-api-design.md`).
- Map exception không xác định → `500 INTERNAL_ERROR` + log full stack.

## 🔴 R-ERR-04: Không nuốt lỗi

```ts
// ❌ Sai
try { ... } catch (e) {}
try { ... } catch { return null; }

// ✅ Đúng
try {
  ...
} catch (err) {
  this.logger.error('Lỗi khi gửi email xác thực', err.stack, { userId });
  throw new InternalServerErrorException({ code: 'EMAIL_SEND_FAILED' });
}
```

## 🔴 R-ERR-05: Re-throw có context

- Khi gọi service ngoài, bắt và **re-throw kèm context** thay vì để lỗi gốc trồi lên trần.
- Wrap external error vào exception nội bộ:

```ts
try {
  await this.smsClient.send(...);
} catch (err) {
  throw new ServiceUnavailableException({
    code: 'SMS_PROVIDER_DOWN',
    cause: err,
  });
}
```

## 🟡 R-ERR-06: Phân loại retryable

- Lỗi tạm thời (network, timeout) → `503` + nên retry.
- Lỗi business / validation → `4xx` không retry.
- Header `Retry-After` cho `429`/`503`.

## 🟡 R-ERR-07: Custom Exception Class

Cho domain phức tạp, viết exception class chuyên biệt:

```ts
// common/exceptions/business.exception.ts
export class BusinessException extends HttpException {
  constructor(code: string, message: string, status = 422) {
    super({ code, message }, status);
  }
}

// usage
throw new BusinessException('MESSAGE_TOO_LONG', 'Tin nhắn vượt giới hạn 5000 ký tự');
```

## 🟡 R-ERR-08: Validation error có chi tiết field

`ValidationPipe` config với `exceptionFactory` → trả `details` array:

```jsonc
{
  "code": "VALIDATION_ERROR",
  "message": "Dữ liệu không hợp lệ",
  "details": [
    { "field": "email", "issue": "phải là email hợp lệ" },
    { "field": "password", "issue": "tối thiểu 8 ký tự" }
  ]
}
```

## Logging exception

- `4xx` → log `warn` (lỗi user).
- `5xx` → log `error` kèm stack.
- Mỗi log có `requestId` để trace.

## Cấm

- ❌ `throw new Error(...)` ở tầng controller/service.
- ❌ `console.error(err)` rồi return null.
- ❌ Lộ stack trace cho client trong `production`.
- ❌ Trả lỗi tiếng Anh / kỹ thuật cho user (giữ tiếng Việt thân thiện).
- ❌ Catch `error` mà không log + không re-throw.
