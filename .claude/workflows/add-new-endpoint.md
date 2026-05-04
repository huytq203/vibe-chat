# Workflow: Thêm endpoint vào module có sẵn

> Áp dụng khi: "thêm endpoint X cho module Y", "viết API cho action Z".

## Step 0 — Xác định loại endpoint

| Loại | Method | Path mẫu | Status code |
|---|---|---|---|
| List | `GET` | `/users` | 200 |
| Detail | `GET` | `/users/:id` | 200 |
| Create | `POST` | `/users` | 201 |
| Update partial | `PATCH` | `/users/:id` | 200 |
| Replace | `PUT` | `/users/:id` | 200 |
| Delete | `DELETE` | `/users/:id` | 204 |
| Custom action | `POST` | `/users/:id/verify` | 200 / 202 |

## Step 1 — Validate quyền truy cập

- Cần auth không? → `@UseGuards(JwtAuthGuard)`.
- Cần role nào? → `@Roles(Role.ADMIN)`.
- Cần ownership? → `@UseGuards(<Resource>OwnerGuard)`.
- Public? → `@Public()`.

## Step 2 — Viết DTO

- Body có dữ liệu input → tạo/sửa `*.dto.ts` theo `patterns/dto-pattern.md`.
- Param phức tạp → tách `ParamXxxDto`.
- Query → bổ sung field vào `query-<feature>.dto.ts`.

## Step 3 — Service method

- Đặt tên method theo intent: `markAsRead`, `verifyEmail`, `archive`.
- Validate business → throw exception kèm `code` (rules/05).
- Persist qua repository.
- Side-effect (event, log).
- Map sang Response DTO.

## Step 4 — Repository method (nếu cần)

- Method theo intent: `incrementUnreadCount(userId)`.
- KHÔNG generic `update(id, anyData)`.

## Step 5 — Controller method

```ts
@Post(':id/verify')
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Xác thực email user' })
@ApiResponse({ status: 200, type: UserResponseDto })
@ApiResponse({ status: 404, description: 'User không tồn tại' })
async verify(
  @Param('id', ParseObjectIdPipe) id: string,
  @Body() dto: VerifyDto,
): Promise<UserResponseDto> {
  return this.service.verify(id, dto);
}
```

## Step 6 — Test

Tối thiểu 3 case:
1. Happy path → 2xx + đúng response.
2. Not found / invalid → 4xx + đúng `code`.
3. Forbidden / unauthorized.

## Step 7 — Verify

```bash
npm run lint
npm run test <feature>.controller.spec
npm run test <feature>.service.spec
npm run start:dev
# → mở Swagger, test thực tế
```

## Definition of Done

- [ ] Endpoint có Swagger đầy đủ (`@ApiOperation`, `@ApiResponse` cho cả success và error).
- [ ] DTO có validate đầu vào.
- [ ] Service throw exception với `code` đúng convention.
- [ ] Có log `info` cho action chính, `error` cho fail.
- [ ] Có unit test cho service method.
- [ ] Có integration test cho controller (mock service).
- [ ] Manual test qua Swagger / Postman thành công.
- [ ] Update Postman collection / OpenAPI export (nếu có).
