# Patterns — Mục lục

> Pattern là **cách triển khai cụ thể** của rule. Khi rule và pattern xung đột → theo rule.

| File | Mục đích |
|---|---|
| [module-pattern.md](./module-pattern.md) | Cấu trúc 1 module hoàn chỉnh |
| [controller-pattern.md](./controller-pattern.md) | REST controller chuẩn |
| [service-pattern.md](./service-pattern.md) | Business logic, orchestration |
| [repository-pattern.md](./repository-pattern.md) | DB access layer |
| [dto-pattern.md](./dto-pattern.md) | DTO request/response/query |
| [guard-pattern.md](./guard-pattern.md) | Auth guard, role guard |
| [interceptor-pattern.md](./interceptor-pattern.md) | Transform, logging, cache |
| [exception-pattern.md](./exception-pattern.md) | Filter + custom exception |

## Khi nào tham chiếu pattern?

- Sinh code mới → đọc pattern liên quan để copy cấu trúc.
- Review code → so với pattern để đánh giá.
- Refactor → bám pattern để chuẩn hoá.
