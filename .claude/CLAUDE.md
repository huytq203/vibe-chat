# CLAUDE.md — Vibe Chat Backend (NestJS)

> File này được auto-load mỗi phiên. Đọc kỹ trước khi sinh code. Mục tiêu: AI hiểu ngữ cảnh trong **<200 dòng**, các nội dung chi tiết được tham chiếu vào file con để **tiết kiệm token**.

---

## 1. Bối cảnh dự án

- **Tên:** `vibe-chat` — Backend cho ứng dụng chat real-time.
- **Stack:** NestJS 11 + TypeScript 5 + (MongoDB/Mongoose hoặc PostgreSQL/Prisma — chọn theo module).
- **Runtime:** Node.js ≥ 20, Express adapter.
- **Test:** Jest + Supertest.
- **Lint/Format:** ESLint 9 + Prettier 3.
- **Domain chính:** `auth`, `users`, sẽ mở rộng `chat`, `messages`, `rooms`, `notifications`, `media`.

## 2. Nguyên tắc cốt lõi (PHẢI tuân thủ)

1. **Modular Monolith** — mỗi feature là 1 module độc lập. Không import trực tiếp giữa các domain module; phải qua `*.service.ts` được export.
2. **Layered Architecture** — `Controller → Service → Repository → Schema/Entity`. Không skip layer.
3. **DTO bắt buộc** — mọi input từ client phải qua `class-validator` DTO. Không dùng `any`.
4. **Type-safe tuyệt đối** — `tsconfig` strict; cấm `any`, `as unknown as`, `// @ts-ignore` (trừ khi có comment giải thích).
5. **Single Responsibility** — 1 file = 1 mục đích. Service không gọi `req/res`. Controller không chứa business logic.
6. **Fail fast** — validate ở biên (DTO, Guard). Bên trong tin nhau.
7. **Idempotent & stateless** — service phải pure khi có thể; state nằm ở DB/cache.
8. **Tiếng Việt cho comment business**, tiếng Anh cho identifier/code.

## 3. Cấu trúc thư mục chuẩn

```
src/
├── main.ts                       # Bootstrap
├── app.module.ts                 # Root module
├── common/                       # Shared cross-cutting (filters, pipes, decorators, interceptors)
│   ├── decorators/
│   ├── filters/                  # GlobalExceptionFilter
│   ├── guards/                   # JwtAuthGuard, RolesGuard
│   ├── interceptors/             # TransformInterceptor, LoggingInterceptor
│   ├── pipes/                    # ValidationPipe custom
│   ├── constants/
│   ├── types/
│   └── utils/
├── config/                       # ConfigModule + env validation
├── database/                     # DB connection module + migrations
└── modules/                      # Domain modules (BẮT BUỘC theo cấu trúc)
    └── <feature>/
        ├── <feature>.module.ts
        ├── <feature>.controller.ts
        ├── <feature>.service.ts
        ├── <feature>.repository.ts   # Khi có DB
        ├── dto/
        │   ├── create-<feature>.dto.ts
        │   ├── update-<feature>.dto.ts
        │   └── query-<feature>.dto.ts
        ├── schemas/                  # Mongoose schema HOẶC entities/ cho TypeORM/Prisma
        ├── interfaces/
        ├── enums/
        ├── events/                   # Domain events (nếu dùng EventEmitter)
        ├── guards/                   # Module-specific guards
        └── tests/
            ├── <feature>.service.spec.ts
            └── <feature>.controller.spec.ts
```

> ⚠️ Cấu trúc hiện tại (`src/auth/`, `src/users/`) đang ở **root** — phải migrate sang `src/modules/` khi thêm module thứ 3.

## 4. Bảng tham chiếu — đọc thêm khi cần

| Tình huống | File cần đọc |
|---|---|
| Thiết kế kiến trúc / module mới | `rules/01-architecture.md`, `patterns/module-pattern.md` |
| Convention naming, format code | `rules/02-coding-style.md` |
| Thiết kế REST endpoint | `rules/03-api-design.md`, `patterns/controller-pattern.md` |
| DB schema, migration, query | `rules/04-database.md`, `patterns/repository-pattern.md` |
| Throw/handle exception | `rules/05-error-handling.md`, `patterns/exception-pattern.md` |
| Validate input, DTO | `rules/06-validation.md`, `patterns/dto-pattern.md` |
| Auth, JWT, RBAC, secrets | `rules/07-security.md`, `patterns/guard-pattern.md` |
| Viết unit/e2e test | `rules/08-testing.md`, `templates/test.template.ts.md` |
| Logger, tracing, metrics | `rules/09-logging-monitoring.md` |
| Cache, query optimize, pagination | `rules/10-performance.md` |
| Tạo module mới từ A→Z | `workflows/add-new-module.md` |
| Thêm endpoint vào module có sẵn | `workflows/add-new-endpoint.md` |
| Code template copy-paste | `templates/*.md` |

## 5. Response style cho AI agent

- **Tiếng Việt** cho giải thích với người dùng. Code/identifier giữ tiếng Anh.
- **Ngắn gọn** — không lặp lại nội dung file đã có; hãy tham chiếu (`xem rules/03-api-design.md`).
- **Sinh code phải đi kèm** đường dẫn file đầy đủ, có sẵn import, đúng template.
- **Trước khi viết code mới** → kiểm tra `templates/` xem đã có template chưa.
- **Trước khi tạo file mới** → kiểm tra cấu trúc thư mục mục 3.
- **Khi user yêu cầu thêm feature** → bám theo workflow tương ứng trong `workflows/`.

## 6. Definition of Done — coi như xong khi

- [ ] Có DTO + validate đầu vào.
- [ ] Có error handling (throw `HttpException` chuẩn).
- [ ] Có log ở mức `info` cho action chính, `error` cho lỗi.
- [ ] Có ít nhất 1 unit test cho service.
- [ ] Đã chạy `npm run lint` và `npm run build` không lỗi.
- [ ] Endpoint mới có Swagger decorator (`@ApiTags`, `@ApiOperation`, `@ApiResponse`).
- [ ] Không hard-code secret/URL/DB connection — phải qua `ConfigService`.

## 7. Lệnh cấm (DO NOT)

- KHÔNG dùng `any`, `Object`, `{}` làm type.
- KHÔNG `console.log` trong production code — dùng `Logger` của Nest.
- KHÔNG truy cập DB từ Controller.
- KHÔNG return Mongoose Document trực tiếp — phải map sang Response DTO.
- KHÔNG bắt `Error` chung chung mà không re-throw có ngữ cảnh.
- KHÔNG tạo circular dependency giữa module — dùng `forwardRef` là dấu hiệu thiết kế sai.
- KHÔNG đặt logic trong `app.module.ts`.
- KHÔNG commit `.env`, `node_modules`, `dist`.

## 8. Ngữ cảnh phiên làm việc

- Khi user nói **"tạo module X"** → theo `workflows/add-new-module.md`.
- Khi user nói **"thêm endpoint Y"** → theo `workflows/add-new-endpoint.md`.
- Khi user nói **"review"** → dùng checklist trong `commands/review.md`.
- Khi không chắc → đọc `rules/00-index.md` để định vị file phù hợp.

---

**Phiên bản:** 1.0 — chuẩn nội bộ vibe-chat
**Cập nhật:** 2026-05-04
