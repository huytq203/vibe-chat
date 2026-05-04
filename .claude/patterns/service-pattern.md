# Service Pattern

## Vai trò

> Service chứa **business logic**, orchestration giữa repo + service khác. Pure khi có thể, không biết gì về HTTP.

## Mẫu chuẩn

```ts
import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { MessagesRepository } from './messages.repository';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { QueryMessageDto } from './dto/query-message.dto';
import { MessageResponseDto } from './dto/response-message.dto';
import { MessageCreatedEvent } from './events/message-created.event';
import { UsersService } from '../users/users.service';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly repo: MessagesRepository,
    private readonly users: UsersService,
    private readonly events: EventEmitter2,
  ) {}

  async create(userId: string, dto: CreateMessageDto): Promise<MessageResponseDto> {
    // 1. Validate business rules
    await this.assertUserCanSendMessage(userId);

    // 2. Persist
    const created = await this.repo.create({ ...dto, authorId: userId });

    // 3. Side-effects (event, notification, cache invalidate)
    this.events.emit('message.created', new MessageCreatedEvent(created.id, userId));
    this.logger.log(`Tin nhắn được tạo: ${created.id} bởi user ${userId}`);

    // 4. Map → Response DTO
    return this.toResponseDto(created);
  }

  async findAll(query: QueryMessageDto) {
    const { items, total } = await this.repo.findPaginated(query);
    return {
      data: items.map((it) => this.toResponseDto(it)),
      meta: this.buildMeta(query.page, query.limit, total),
    };
  }

  async findOne(id: string): Promise<MessageResponseDto> {
    const doc = await this.repo.findById(id);
    if (!doc) {
      throw new NotFoundException({
        code: 'MESSAGE_NOT_FOUND',
        message: `Không tìm thấy tin nhắn ${id}`,
      });
    }
    return this.toResponseDto(doc);
  }

  async update(userId: string, id: string, dto: UpdateMessageDto): Promise<MessageResponseDto> {
    const doc = await this.repo.findById(id);
    if (!doc) throw new NotFoundException({ code: 'MESSAGE_NOT_FOUND' });
    if (doc.authorId !== userId) {
      throw new ForbiddenException({
        code: 'MESSAGE_NOT_OWNED',
        message: 'Bạn không có quyền chỉnh sửa tin nhắn này',
      });
    }
    const updated = await this.repo.update(id, dto);
    return this.toResponseDto(updated);
  }

  async remove(id: string): Promise<void> {
    const ok = await this.repo.softDelete(id);
    if (!ok) throw new NotFoundException({ code: 'MESSAGE_NOT_FOUND' });
    this.logger.log(`Đã xoá tin nhắn ${id}`);
  }

  // ── private helpers ────────────────────────────────
  private async assertUserCanSendMessage(userId: string): Promise<void> {
    const user = await this.users.findOne(userId);
    if (user.isBanned) {
      throw new ForbiddenException({
        code: 'USER_BANNED',
        message: 'Tài khoản đã bị khoá, không thể gửi tin nhắn',
      });
    }
  }

  private toResponseDto(doc: MessageDocument): MessageResponseDto {
    return {
      id: doc._id.toString(),
      content: doc.content,
      authorId: doc.authorId,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  private buildMeta(page: number, limit: number, total: number) {
    return {
      page, limit, total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    };
  }
}
```

## Quy tắc

1. **`logger` private readonly** với context = class name.
2. **Constructor inject** repository + services khác. KHÔNG `new`.
3. **Method public** có return type explicit.
4. **Validate business rule trước → persist → side-effect → map response**.
5. **Side-effect bất đồng bộ (event, queue)** thay vì gọi sync khi không cần.
6. **Helper private** ở cuối class, có comment phân tách.
7. **KHÔNG** truy cập `req`, `res`, header, cookie.

## Khi nào dùng transaction?

```ts
async transferCredit(fromId: string, toId: string, amount: number) {
  return this.connection.transaction(async (session) => {
    await this.repo.decrement(fromId, amount, { session });
    await this.repo.increment(toId, amount, { session });
    await this.audit.log({ from: fromId, to: toId, amount }, { session });
  });
}
```

→ Khi 1 use-case ghi nhiều entity và cần atomic.

## Anti-pattern

| ❌ Sai | ✅ Đúng |
|---|---|
| Inject `Model<User>` trực tiếp | Inject `UsersRepository` |
| `throw new Error('not found')` | `throw new NotFoundException({ code, message })` |
| Trả về `Mongoose Document` | Trả `ResponseDto` |
| Gọi service module khác qua import path file | Qua module exports |
| Logic if/else > 3 cấp lồng | Tách helper hoặc strategy pattern |
| Service biết HTTP status code | Để filter/exception lo |
