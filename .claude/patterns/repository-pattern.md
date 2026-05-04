# Repository Pattern

## Vai trò

> Repository là **DB access layer** — duy nhất nơi đụng vào Model/Prisma/TypeORM. Service không biết DB driver.

## Mẫu Mongoose

```ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery, ClientSession } from 'mongoose';

import { Message, MessageDocument } from './schemas/message.schema';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { QueryMessageDto } from './dto/query-message.dto';

@Injectable()
export class MessagesRepository {
  constructor(
    @InjectModel(Message.name) private readonly model: Model<MessageDocument>,
  ) {}

  async create(data: CreateMessageDto & { authorId: string }, session?: ClientSession) {
    const [doc] = await this.model.create([data], { session });
    return doc;
  }

  async findById(id: string): Promise<MessageDocument | null> {
    return this.model.findOne({ _id: id, deletedAt: null }).lean<MessageDocument>().exec();
  }

  async findPaginated(query: QueryMessageDto) {
    const { page = 1, limit = 20, sortBy = 'createdAt', order = 'desc', roomId } = query;
    const filter: FilterQuery<MessageDocument> = { deletedAt: null };
    if (roomId) filter.roomId = roomId;

    const [items, total] = await Promise.all([
      this.model
        .find(filter)
        .sort({ [sortBy]: order === 'desc' ? -1 : 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<MessageDocument[]>()
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);

    return { items, total };
  }

  async update(id: string, dto: UpdateMessageDto): Promise<MessageDocument | null> {
    return this.model
      .findOneAndUpdate({ _id: id, deletedAt: null }, dto, { new: true })
      .lean<MessageDocument>()
      .exec();
  }

  async softDelete(id: string): Promise<boolean> {
    const res = await this.model.updateOne(
      { _id: id, deletedAt: null },
      { deletedAt: new Date() },
    );
    return res.modifiedCount > 0;
  }

  async findManyByIds(ids: string[]): Promise<MessageDocument[]> {
    return this.model
      .find({ _id: { $in: ids }, deletedAt: null })
      .lean<MessageDocument[]>()
      .exec();
  }
}
```

## Mẫu Prisma

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { Prisma, User } from '@prisma/client';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.UserCreateInput, tx?: Prisma.TransactionClient): Promise<User> {
    return (tx ?? this.prisma).user.create({ data });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { id, deletedAt: null } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findPaginated(args: { page: number; limit: number; role?: string }) {
    const { page, limit, role } = args;
    const where: Prisma.UserWhereInput = { deletedAt: null, ...(role && { role }) };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total };
  }
}
```

## Quy tắc

1. **Tên method theo intent**: `findActiveUsersByRole`, `incrementUnreadCount` — KHÔNG `find(filter)` chung.
2. **Soft delete mặc định** — query luôn lọc `deletedAt: null` (trừ khi method có `IncludingDeleted`).
3. **Trả về `null`** khi không tìm thấy (không throw). Service quyết định throw.
4. **Nhận `session`/`tx` param tuỳ chọn** để hỗ trợ transaction.
5. **`.lean()` cho Mongoose** khi không cần Document method.
6. **Không throw HttpException** — repository không biết HTTP. Throw tech error thuần để service wrap.
7. **Index gắn với schema** chứ không tạo trong repository.

## Anti-pattern

| ❌ Sai | ✅ Đúng |
|---|---|
| `findOne(filter: any)` | `findById(id)`, `findByEmail(email)` |
| Throw `NotFoundException` | Trả `null`, service throw |
| Logic business: `if (user.role === 'admin')` | Đẩy ra service |
| `find()` không limit | `findPaginated` hoặc `findFirst` |
| Repository inject service | Repository chỉ dùng model, không inject service |
| Cache trong repository | Cache ở service hoặc decorator |
