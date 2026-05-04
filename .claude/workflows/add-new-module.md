# Workflow: Thêm module mới

> Áp dụng khi user nói: "tạo module X", "thêm feature X", "build domain X".

## Step 0 — Hỏi để hiểu yêu cầu

Trước khi sinh code, **xác nhận với user 5 câu hỏi**:
1. Tên domain (số nhiều, kebab-case): `messages`, `chat-rooms`...
2. Các entity chính + field cốt lõi.
3. Endpoint dự kiến (CRUD đầy đủ hay chỉ vài action).
4. Quan hệ với module khác (ví dụ: `messages` cần `users`).
5. Có cần real-time (WebSocket), event, queue không?

Nếu user đã cung cấp đủ → bỏ qua step 0.

## Step 1 — Tạo cấu trúc thư mục

```
src/modules/<feature>/
├── <feature>.module.ts
├── <feature>.controller.ts
├── <feature>.service.ts
├── <feature>.repository.ts
├── dto/
│   ├── create-<feature>.dto.ts
│   ├── update-<feature>.dto.ts
│   ├── query-<feature>.dto.ts
│   └── response-<feature>.dto.ts
├── schemas/
│   └── <feature>.schema.ts
├── interfaces/
├── enums/
├── events/
├── guards/
└── tests/
    ├── <feature>.service.spec.ts
    └── <feature>.controller.spec.ts
```

> Tham chiếu `templates/` để copy template từng file.

## Step 2 — Schema (DB)

- Theo `rules/04-database.md`.
- Field bắt buộc: `_id`/`id`, `createdAt`, `updatedAt`, `deletedAt`.
- Khai báo index ngay tại schema.
- Nếu có FK → kiểu `Types.ObjectId` (Mongoose) hoặc `String @relation` (Prisma).

## Step 3 — DTO

Tạo 4 file DTO theo `patterns/dto-pattern.md`:
- `create-<feature>.dto.ts` — input cho POST.
- `update-<feature>.dto.ts` — `extends PartialType(OmitType(CreateDto, [...]))`.
- `query-<feature>.dto.ts` — pagination + filter.
- `response-<feature>.dto.ts` — output trả client.

## Step 4 — Repository

Theo `patterns/repository-pattern.md`. Method tối thiểu:
- `create(data, session?)`
- `findById(id)`
- `findPaginated(query)`
- `update(id, dto)`
- `softDelete(id)`

Bổ sung method theo intent business của module.

## Step 5 — Service

Theo `patterns/service-pattern.md`:
- Constructor inject `repo` + service module khác (qua exports).
- Method: `create`, `findAll`, `findOne`, `update`, `remove`.
- Mỗi method: validate business → persist → side-effect → map response.
- Helper `toResponseDto(doc)` private.

## Step 6 — Controller

Theo `patterns/controller-pattern.md`:
- `@ApiTags`, `@ApiBearerAuth`, `@UseGuards(JwtAuthGuard)`.
- 5 endpoint cơ bản: POST, GET list, GET one, PATCH, DELETE.
- Mọi endpoint có `@ApiOperation`, `@ApiResponse`.
- Dùng `@CurrentUser()` cho userId.

## Step 7 — Module

Theo `patterns/module-pattern.md`:
- `imports`: `MongooseModule.forFeature`/`PrismaModule` + module khác cần.
- `controllers`, `providers`, `exports: [<Service>]`.

## Step 8 — Đăng ký vào `app.module.ts`

```ts
@Module({
  imports: [..., <Feature>Module],
})
export class AppModule {}
```

## Step 9 — Test

Theo `rules/08-testing.md`:
- `<feature>.service.spec.ts`: unit test mỗi method (happy + error path).
- `<feature>.controller.spec.ts`: test HTTP layer mock service.
- E2E (`test/<feature>.e2e-spec.ts`) tối thiểu cho POST + GET.

## Step 10 — Verify

```bash
npm run lint
npm run build
npm run test -- <feature>
```

## Definition of Done

- [ ] Cấu trúc thư mục đúng (Step 1).
- [ ] Schema có index + timestamps + soft delete.
- [ ] 4 DTO có `@ApiProperty` đầy đủ.
- [ ] Service không truy cập DB trực tiếp, không return Document raw.
- [ ] Controller mỗi method có Swagger metadata.
- [ ] Module export đúng Service.
- [ ] Đăng ký trong `AppModule`.
- [ ] Có ít nhất 3 unit test (happy, not found, forbidden).
- [ ] `npm run lint && npm run build` không lỗi.
- [ ] Swagger `/api/docs` hiển thị endpoint mới đầy đủ.
- [ ] (Nếu có FE) thông báo response shape cho FE team.
