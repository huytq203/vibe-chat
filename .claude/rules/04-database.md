# 04 — Database

> Dự án có thể dùng **MongoDB (Mongoose)** hoặc **PostgreSQL (Prisma/TypeORM)**. Chọn 1 và nhất quán toàn dự án. Mặc định khuyến nghị: **MongoDB** cho `messages/rooms` (high write), **PostgreSQL** cho `users/auth` (relational).

## 🔴 R-DB-01: Repository Pattern bắt buộc

- Mọi DB query đi qua `<feature>.repository.ts`.
- Service KHÔNG inject `Model`/`PrismaClient` trực tiếp.
- Repository expose method **theo intent business**, không phải CRUD generic:
  - ✅ `findActiveUsersByRole(role)` 
  - ❌ `find(filter)` chung chung

## 🔴 R-DB-02: Schema phải có

- `_id` / `id` (auto).
- `createdAt`, `updatedAt` (timestamps).
- `deletedAt` nếu **soft delete** (KHÔNG xoá cứng dữ liệu user-related).
- `version` cho document hay update concurrent (optimistic locking).

## 🔴 R-DB-03: Index bắt buộc

- Mọi field dùng trong `WHERE` thường xuyên → có index.
- Compound index theo thứ tự selectivity (cao trước).
- Unique constraint qua DB, không qua code.
- Khai báo index ngay tại schema, không tạo manual ở mongo shell.

```ts
// Mongoose
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ status: 1, createdAt: -1 });
```

## 🔴 R-DB-04: Transaction cho multi-write

- Khi 1 use-case ghi ≥ 2 collection/table → bọc transaction.
- Mongoose: `session = await connection.startSession(); session.withTransaction(...)`.
- Prisma: `prisma.$transaction([...])`.
- Repository nhận `session` qua param tuỳ chọn.

## 🔴 R-DB-05: Không expose Document

- Service mapping document → plain object / Response DTO trước khi return cho controller.
- KHÔNG return `Document<User>` ra ngoài service.

```ts
// ❌ Sai
async findOne(id: string): Promise<UserDocument> {
  return this.userModel.findById(id);
}

// ✅ Đúng
async findOne(id: string): Promise<UserResponseDto> {
  const doc = await this.repo.findById(id);
  if (!doc) throw new NotFoundException({ code: 'USER_NOT_FOUND' });
  return this.toResponseDto(doc);
}
```

## 🔴 R-DB-06: Migration

- **Prisma:** `prisma migrate dev` → commit thư mục `prisma/migrations/`.
- **TypeORM:** dùng `migration:generate`, không bao giờ bật `synchronize: true` ở môi trường ngoài dev.
- **MongoDB:** không có migration framework chuẩn → viết script trong `database/migrations/<timestamp>-<name>.ts` chạy 1 lần.
- Mỗi migration **idempotent** và **reversible** khi có thể.

## 🟡 R-DB-07: N+1 query

- Dùng `populate` (Mongoose) / `include` (Prisma) / `relations` (TypeORM) thay vì loop query.
- Nếu populate nặng → tách thành 2 query rõ ràng và dùng `$lookup`/`JOIN`.

## 🟡 R-DB-08: Query timeout & limit

- Mọi `find` có `.limit()` rõ ràng (không bao giờ trả unbounded list).
- Set `maxTimeMS` cho query nặng.

## 🟡 R-DB-09: Soft delete

- Field `deletedAt: Date | null`.
- Repo có helper `findNotDeleted()`. Mặc định query loại bỏ doc đã xoá.
- Cron job xoá cứng sau X ngày (theo policy).

## 🟢 R-DB-10: Sharding/replication

- Khi quy mô lớn → bật replica set, đọc từ secondary cho query không cần consistency.
- Sharding theo `userId`/`roomId` cho `messages`.

## Connection management

- 1 instance DB connection global (qua `DatabaseModule`).
- Cấu hình từ `ConfigService`, KHÔNG hard-code.
- Pool size theo môi trường: dev 10, prod 50–100.
- Health check endpoint `/health` ping DB.

## Naming convention

| Loại | Convention | Ví dụ |
|---|---|---|
| Collection / Table | snake_case số nhiều | `users`, `chat_rooms` |
| Field | camelCase (Mongo) / snake_case (SQL) | `createdAt` / `created_at` |
| Foreign key | `<entity>Id` / `<entity>_id` | `userId` / `user_id` |
| Index name | `idx_<table>_<field>` | `idx_users_email` |

## Cấm

- ❌ Truy cập DB từ Controller / Guard / Pipe (chỉ qua Service → Repository).
- ❌ `synchronize: true` ngoài dev.
- ❌ Query không có limit.
- ❌ Lưu password plain text. Hash với bcrypt cost ≥ 12.
- ❌ Lưu PII không mã hoá nếu yêu cầu compliance.
