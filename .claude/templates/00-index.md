# Templates — Mục lục

> Code template **copy-paste** cho mỗi loại file. Khi sinh code mới, BẮT ĐẦU từ template, sau đó tuỳ biến.

| File | Dùng khi |
|---|---|
| [module.template.md](./module.template.md) | Tạo file `*.module.ts` |
| [controller.template.md](./controller.template.md) | Tạo file `*.controller.ts` |
| [service.template.md](./service.template.md) | Tạo file `*.service.ts` |
| [repository.template.md](./repository.template.md) | Tạo file `*.repository.ts` |
| [dto.template.md](./dto.template.md) | Tạo các file DTO |
| [schema.template.md](./schema.template.md) | Tạo file `*.schema.ts` (Mongoose) |
| [test.template.md](./test.template.md) | Tạo file `*.spec.ts` |

## Cách dùng

1. Tìm template tương ứng với loại file cần tạo.
2. Copy block code → paste vào file mới.
3. Replace placeholder: `<feature>`, `<Feature>`, `<FEATURE>`.
4. Tuỳ biến field/method theo yêu cầu.
5. Đối chiếu lại với `patterns/<kind>-pattern.md` xem có lệch không.

## Quy ước placeholder

| Placeholder | Convention | Ví dụ |
|---|---|---|
| `<feature>` | kebab-case, số nhiều | `messages`, `chat-rooms` |
| `<Feature>` | PascalCase, số nhiều | `Messages`, `ChatRooms` |
| `<FeatureSingular>` | PascalCase, số ít | `Message`, `ChatRoom` |
| `<FEATURE>` | UPPER_SNAKE | `MESSAGE`, `CHAT_ROOM` |
