# Module Pattern

## Cấu trúc 1 module hoàn chỉnh

```
src/modules/messages/
├── messages.module.ts
├── messages.controller.ts
├── messages.service.ts
├── messages.repository.ts
├── dto/
│   ├── create-message.dto.ts
│   ├── update-message.dto.ts
│   ├── query-message.dto.ts
│   └── response-message.dto.ts
├── schemas/
│   └── message.schema.ts
├── interfaces/
│   └── message.interface.ts
├── enums/
│   └── message-type.enum.ts
├── events/
│   └── message-created.event.ts
├── guards/
│   └── message-owner.guard.ts
└── tests/
    ├── messages.service.spec.ts
    └── messages.controller.spec.ts
```

## Module file mẫu

```ts
// messages.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { MessagesRepository } from './messages.repository';
import { Message, MessageSchema } from './schemas/message.schema';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Message.name, schema: MessageSchema }]),
    UsersModule, // Để inject UsersService
  ],
  controllers: [MessagesController],
  providers: [MessagesService, MessagesRepository],
  exports: [MessagesService], // Module khác chỉ dùng Service
})
export class MessagesModule {}
```

## Quy tắc

1. **Imports**: chỉ import module khác qua tên module, KHÔNG import provider trực tiếp.
2. **Providers**: liệt kê service + repository + custom provider.
3. **Controllers**: chỉ liệt kê controller của module này.
4. **Exports**: chỉ export `Service` (không export `Repository`, `Schema`).
5. **Cyclic dependency**: nếu cần `forwardRef()` → dấu hiệu thiết kế sai, refactor.

## Đăng ký vào AppModule

```ts
// app.module.ts
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema: envSchema }),
    DatabaseModule,
    LoggerModule,
    AuthModule,
    UsersModule,
    MessagesModule, // ← thêm vào đây
  ],
})
export class AppModule {}
```

## Anti-pattern

| ❌ Sai | ✅ Đúng |
|---|---|
| Module export Repository | Chỉ export Service |
| Module có cả `controller` cho 2 domain | Tách 2 module riêng |
| `imports: [SomeService]` | `imports: [SomeModule]` |
| Nhiều `forwardRef` | Tách shared module thứ 3 |
| Logic trong `app.module.ts` | App module chỉ là composition root |
