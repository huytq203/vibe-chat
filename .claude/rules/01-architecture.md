# 01 — Kiến trúc

## Mô hình: Modular Monolith + Layered Architecture

```
HTTP Request
    ↓
[Middleware] (cors, helmet, body-parser)
    ↓
[Guard] (Auth, Roles)
    ↓
[Pipe] (Validation, Transform)
    ↓
[Controller]  ← chỉ điều phối, KHÔNG có business logic
    ↓
[Service]     ← business logic, transaction, orchestration
    ↓
[Repository]  ← truy cập DB (1 repo = 1 entity)
    ↓
[Schema/Entity]
```

## 🔴 R-01: Mỗi domain = 1 module độc lập

- 1 module có đầy đủ `controller + service + repository + dto + schema`.
- KHÔNG cho phép `UserService` import trực tiếp `MessageRepository`. Phải đi qua `MessageService`.
- Module export những gì cần share qua `exports: [XxxService]`.

## 🔴 R-02: Không skip layer

| Sai | Đúng |
|---|---|
| Controller gọi thẳng `Repository` | Controller → Service → Repository |
| Service trả về `Mongoose Document` cho Controller | Service map sang Response DTO/Plain Object |
| Repository chứa business logic (`if user.role === ...`) | Logic đó nằm ở Service |

## 🔴 R-03: Dependency Injection - không dùng `new`

- KHÔNG `new SomeService()` trong code production. Inject qua constructor.
- Provider khai báo trong `providers: []` của module.
- Nếu cần factory → dùng `useFactory`.

## 🔴 R-04: Cấm circular dependency

- `ModuleA` import `ModuleB`, mà `ModuleB` cũng cần `ModuleA` → tách phần chung ra **module thứ 3** (shared).
- `forwardRef()` chỉ dùng khi BẮT BUỘC; coi đó là code smell và phải để TODO refactor.

## 🟡 R-05: Tách `common/` cho code dùng chung

- `common/` chứa decorator, filter, guard, pipe, interceptor, util **không thuộc domain nào**.
- Nếu 1 thứ chỉ 1 module dùng → đặt **trong module đó**, không nhét lên `common/`.

## 🟡 R-06: Boundary giữa các tầng

| Tầng | Được phép | Cấm |
|---|---|---|
| Controller | Decorator, gọi service, trả response | DB query, raw business logic |
| Service | Business logic, gọi repo, gọi service khác (cùng/khác module qua exports) | `req`, `res`, HTTP-specific |
| Repository | DB query, mapping data | Throw `HttpException`, business logic |

## 🟡 R-07: Bootstrap gọn

- `main.ts` chỉ chứa: `NestFactory.create`, global pipe/filter/interceptor, swagger setup, `listen(port)`.
- KHÔNG đặt route, business logic ở `main.ts`.

## Ví dụ: cấu trúc 1 module chuẩn

```
src/modules/messages/
├── messages.module.ts
├── messages.controller.ts        # API
├── messages.service.ts           # Business logic
├── messages.repository.ts        # DB access
├── dto/
│   ├── create-message.dto.ts
│   ├── update-message.dto.ts
│   ├── query-message.dto.ts
│   └── response-message.dto.ts
├── schemas/
│   └── message.schema.ts         # Mongoose schema
├── interfaces/
│   └── message.interface.ts
├── enums/
│   └── message-type.enum.ts
├── events/
│   └── message-created.event.ts  # Domain event
└── tests/
    ├── messages.service.spec.ts
    └── messages.controller.spec.ts
```

## Khi nào tách microservice?

- KHÔNG tách sớm. Bắt đầu với modular monolith.
- Tín hiệu cần tách: 1 module có scaling pattern khác hẳn (ví dụ media upload), team riêng, hoặc cần stack khác.
