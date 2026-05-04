# 03 — API Design (REST)

## Convention URL

- Tài nguyên dạng số nhiều: `/users`, `/messages`, `/rooms`.
- Lồng tối đa 2 cấp: `/rooms/:roomId/messages`. Sâu hơn → query param.
- Dùng `kebab-case` cho path: `/api/v1/chat-rooms`.
- Không có động từ trong path. Trừ action không CRUD: `/auth/login`, `/auth/refresh`, `/messages/:id/seen`.

## Versioning

- Prefix `/api/v1/...`. Major version mới khi breaking change.
- Cấu hình: `app.setGlobalPrefix('api'); app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });`

## HTTP Method ↔ Action

| Method | Action | Idempotent | Ví dụ |
|---|---|---|---|
| `GET /xxx` | List | ✅ | `GET /users?page=1` |
| `GET /xxx/:id` | Get one | ✅ | `GET /users/123` |
| `POST /xxx` | Create | ❌ | `POST /users` |
| `PUT /xxx/:id` | Replace toàn bộ | ✅ | `PUT /users/123` |
| `PATCH /xxx/:id` | Update partial | ✅ | `PATCH /users/123` |
| `DELETE /xxx/:id` | Delete | ✅ | `DELETE /users/123` |

## Status Code chuẩn

| Code | Khi nào |
|---|---|
| `200 OK` | GET / PATCH / PUT thành công có body |
| `201 Created` | POST thành công, tạo resource |
| `204 No Content` | DELETE thành công, không body |
| `400 Bad Request` | Validation lỗi, request format sai |
| `401 Unauthorized` | Chưa đăng nhập / token invalid |
| `403 Forbidden` | Đã đăng nhập nhưng không đủ quyền |
| `404 Not Found` | Resource không tồn tại |
| `409 Conflict` | Trùng (email tồn tại, version mismatch) |
| `422 Unprocessable Entity` | Business rule fail |
| `429 Too Many Requests` | Rate limit |
| `500 Internal Server Error` | Server lỗi không lường trước |
| `503 Service Unavailable` | DB / external service down |

## 🔴 R-API-01: Response envelope thống nhất

```jsonc
// Success
{
  "success": true,
  "data": { "id": "u_1", "name": "Huy" },
  "meta": { "page": 1, "limit": 20, "total": 100 },  // chỉ khi paginate
  "timestamp": "2026-05-04T10:00:00.000Z"
}

// Error
{
  "success": false,
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "Không tìm thấy người dùng",
    "details": [{ "field": "email", "issue": "must be a valid email" }]
  },
  "timestamp": "2026-05-04T10:00:00.000Z",
  "path": "/api/v1/users/123",
  "requestId": "req_abc123"
}
```

→ Implement bằng global `TransformInterceptor` + `AllExceptionsFilter`. Xem `patterns/interceptor-pattern.md`.

## 🔴 R-API-02: Pagination chuẩn

- Query: `?page=1&limit=20&sortBy=createdAt&order=desc`.
- Tối đa `limit=100`. Default `limit=20`.
- Trả về `meta: { page, limit, total, totalPages, hasNext, hasPrev }`.
- Cursor-based khi list dài / real-time: `?cursor=xxx&limit=20` → `meta: { nextCursor }`.

## 🔴 R-API-03: Error code cố định

- Mỗi exception phải có **code string** để FE xử lý không phụ thuộc message.
- Format: `<DOMAIN>_<REASON>` UPPER_SNAKE: `USER_NOT_FOUND`, `AUTH_TOKEN_EXPIRED`, `MESSAGE_TOO_LONG`.
- Tập hợp trong `common/constants/error-codes.ts`.

## 🟡 R-API-04: Idempotency cho POST quan trọng

- Endpoint tạo payment / order → nhận header `Idempotency-Key`.
- Lưu key + response trong cache 24h. Request trùng key → trả response cũ.

## 🟡 R-API-05: Filter / search

- Filter đơn giản: `?status=active&role=admin`.
- Filter phức tạp: dùng query DSL như `?filter[status]=active&filter[createdAt][gte]=...`.
- Search: `?q=keyword`. Full-text search → có index/Elasticsearch.

## 🟡 R-API-06: Bulk action

- `POST /users/bulk-create` body `{ items: [...] }` (tránh quá tải request line).
- Trả `{ success: [...], failed: [{ index, error }] }` để FE xử lý từng item.

## Swagger (OpenAPI)

🔴 BẮT BUỘC mỗi controller/method có:

```ts
@ApiTags('users')
@Controller('users')
export class UsersController {
  @Post()
  @ApiOperation({ summary: 'Tạo user mới' })
  @ApiResponse({ status: 201, description: 'Tạo thành công', type: UserResponseDto })
  @ApiResponse({ status: 409, description: 'Email đã tồn tại' })
  @ApiBody({ type: CreateUserDto })
  create(@Body() dto: CreateUserDto) { ... }
}
```

- Response DTO **bắt buộc khai báo** với `@ApiProperty` cho mỗi field.
- Swagger endpoint: `/api/docs`.

## Cấm

- ❌ Trả mảng raw `[...]` ở root (vướng response envelope).
- ❌ Dùng `200` cho lỗi (kiểu `{ success: false }` với 200) — phải đúng status code.
- ❌ Lộ stack trace trong production.
- ❌ Endpoint không có Swagger metadata.
