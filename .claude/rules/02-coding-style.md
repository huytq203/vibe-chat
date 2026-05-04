# 02 — Coding Style

## Naming

| Loại | Convention | Ví dụ |
|---|---|---|
| File | `kebab-case.kind.ts` | `create-user.dto.ts`, `users.service.ts` |
| Class | `PascalCase` | `UsersService`, `CreateUserDto` |
| Interface | `PascalCase`, KHÔNG prefix `I` | `User` (không phải `IUser`) |
| Type alias | `PascalCase` | `UserId = string` |
| Enum | `PascalCase`, member `UPPER_SNAKE` | `MessageType.TEXT_MESSAGE` |
| Variable / function | `camelCase` | `getUserById`, `isActive` |
| Constant | `UPPER_SNAKE_CASE` | `MAX_RETRY = 3` |
| Boolean | prefix `is/has/should/can` | `isActive`, `hasRole` |
| Generic type | 1 chữ hoặc `T*` | `T`, `TUser` |
| Folder | `kebab-case` số nhiều cho domain | `users/`, `messages/` |

## File suffix bắt buộc

| Suffix | Dùng cho |
|---|---|
| `.module.ts` | NestModule |
| `.controller.ts` | Controller |
| `.service.ts` | Service |
| `.repository.ts` | Repository |
| `.dto.ts` | DTO |
| `.schema.ts` | Mongoose schema |
| `.entity.ts` | TypeORM/Prisma entity |
| `.guard.ts` | Guard |
| `.interceptor.ts` | Interceptor |
| `.pipe.ts` | Pipe |
| `.filter.ts` | Exception filter |
| `.decorator.ts` | Decorator |
| `.interface.ts` | Interface |
| `.enum.ts` | Enum |
| `.event.ts` | Domain event |
| `.spec.ts` | Unit test |
| `.e2e-spec.ts` | E2E test |

## Import order (top → bottom)

```ts
// 1. Node built-ins
import { readFile } from 'node:fs/promises';

// 2. External packages (thư viện thứ 3)
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

// 3. Internal absolute (alias @/)
import { LoggerService } from '@/common/logger/logger.service';

// 4. Internal relative (cùng module)
import { User } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';

// 5. Type-only import (cuối, dùng `import type`)
import type { UserId } from './interfaces/user.interface';
```

> Đặt alias `@/*` → `src/*` trong `tsconfig.json` để tránh `../../../`.

## Format (Prettier — đã cấu hình)

- 2 spaces.
- Single quote.
- Trailing comma `all`.
- Semi: bật.
- Print width: 100.
- Arrow paren: `always`.

## Quy tắc viết hàm

- Hàm ≤ 30 dòng. Vượt → tách.
- Tham số ≤ 3. Nhiều hơn → gộp thành object DTO.
- Return type **bắt buộc khai báo** (không để TS suy luận với hàm public).
- Async function bắt buộc trả `Promise<T>` rõ ràng.

## Comment

- KHÔNG comment cái mà code đã nói (`// tăng counter` cho `counter++`).
- CÓ comment cho **WHY** không hiển nhiên: ràng buộc business, bug đã fix, hack có chủ ý.
- TODO/FIXME có format: `// TODO(huy): mô tả — 2026-05-04`.
- JSDoc bắt buộc cho public method của service được module khác sử dụng.

## Cấm

- ❌ `any`, `Function`, `Object`, `{}` (dùng `unknown` + narrow nếu thực sự cần).
- ❌ `// @ts-ignore` — phải là `// @ts-expect-error LÝ_DO`.
- ❌ Magic number / string trong logic → đưa vào `constants/`.
- ❌ Default export — luôn named export.
- ❌ `var`. Dùng `const` mặc định, `let` khi reassign.
- ❌ Nested ternary > 2 cấp.

## Khuyến nghị

- Sử dụng `readonly` cho property không bị thay đổi.
- Prefer `Pick`/`Omit`/`Partial` thay vì viết lại type.
- Optional chaining `?.` và nullish coalescing `??` thay nested if.
- Early return thay vì nested if.
