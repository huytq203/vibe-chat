# Rules — Mục lục

> Quy tắc bắt buộc cho dự án. Mỗi rule có format: **Quy tắc → Lý do → Ví dụ Đúng/Sai**.

| # | File | Phạm vi |
|---|---|---|
| 01 | [architecture.md](./01-architecture.md) | Modular monolith, layered architecture, DI |
| 02 | [coding-style.md](./02-coding-style.md) | Naming, formatting, import order, comment |
| 03 | [api-design.md](./03-api-design.md) | RESTful conventions, response envelope, status code |
| 04 | [database.md](./04-database.md) | Schema, index, transaction, migration |
| 05 | [error-handling.md](./05-error-handling.md) | Exception filter, error code, logging |
| 06 | [validation.md](./06-validation.md) | DTO, class-validator, sanitize |
| 07 | [security.md](./07-security.md) | Auth, JWT, RBAC, secret, OWASP |
| 08 | [testing.md](./08-testing.md) | Unit / integration / e2e |
| 09 | [logging-monitoring.md](./09-logging-monitoring.md) | Logger, correlation id, metric |
| 10 | [performance.md](./10-performance.md) | Cache, pagination, N+1 |

## Nguyên tắc đọc rule

1. Khi không chắc → đọc rule liên quan và hỏi user TRƯỚC khi sinh code.
2. Rule có ưu tiên cao hơn pattern (`patterns/`). Khi xung đột → theo rule.
3. Mỗi rule có cờ độ quan trọng: 🔴 BẮT BUỘC | 🟡 KHUYẾN NGHỊ | 🟢 TUỲ CHỌN.
