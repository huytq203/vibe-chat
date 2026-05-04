# Template — `<feature>.repository.ts` (Mongoose)

```ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery, ClientSession } from 'mongoose';

import { <FeatureSingular>, <FeatureSingular>Document } from './schemas/<feature-singular>.schema';
import { Create<FeatureSingular>Dto } from './dto/create-<feature-singular>.dto';
import { Update<FeatureSingular>Dto } from './dto/update-<feature-singular>.dto';
import { Query<FeatureSingular>Dto } from './dto/query-<feature-singular>.dto';

@Injectable()
export class <Feature>Repository {
  constructor(
    @InjectModel(<FeatureSingular>.name)
    private readonly model: Model<<FeatureSingular>Document>,
  ) {}

  async create(
    data: Create<FeatureSingular>Dto & { ownerId: string },
    session?: ClientSession,
  ): Promise<<FeatureSingular>Document> {
    const [doc] = await this.model.create([data], { session });
    return doc;
  }

  async findById(id: string): Promise<<FeatureSingular>Document | null> {
    return this.model
      .findOne({ _id: id, deletedAt: null })
      .lean<<FeatureSingular>Document>()
      .exec();
  }

  async findPaginated(query: Query<FeatureSingular>Dto): Promise<{
    items: <FeatureSingular>Document[];
    total: number;
  }> {
    const { page = 1, limit = 20, sortBy = 'createdAt', order = 'desc' } = query;
    const filter: FilterQuery<<FeatureSingular>Document> = { deletedAt: null };

    // TODO: thêm filter cụ thể từ query
    // if (query.status) filter.status = query.status;

    const [items, total] = await Promise.all([
      this.model
        .find(filter)
        .sort({ [sortBy]: order === 'desc' ? -1 : 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<<FeatureSingular>Document[]>()
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }

  async update(
    id: string,
    dto: Update<FeatureSingular>Dto,
  ): Promise<<FeatureSingular>Document | null> {
    return this.model
      .findOneAndUpdate({ _id: id, deletedAt: null }, dto, { new: true })
      .lean<<FeatureSingular>Document>()
      .exec();
  }

  async softDelete(id: string): Promise<boolean> {
    const res = await this.model.updateOne(
      { _id: id, deletedAt: null },
      { deletedAt: new Date() },
    );
    return res.modifiedCount > 0;
  }

  async findManyByIds(ids: string[]): Promise<<FeatureSingular>Document[]> {
    return this.model
      .find({ _id: { $in: ids }, deletedAt: null })
      .lean<<FeatureSingular>Document[]>()
      .exec();
  }
}
```

## Variant: Prisma

```ts
import { Injectable } from '@nestjs/common';
import { Prisma, <FeatureSingular> } from '@prisma/client';
import { PrismaService } from '@/database/prisma.service';

@Injectable()
export class <Feature>Repository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.<FeatureSingular>CreateInput, tx?: Prisma.TransactionClient) {
    return (tx ?? this.prisma).<feature-singular>.create({ data });
  }

  findById(id: string): Promise<<FeatureSingular> | null> {
    return this.prisma.<feature-singular>.findFirst({ where: { id, deletedAt: null } });
  }

  async findPaginated(args: { page: number; limit: number }) {
    const { page, limit } = args;
    const where: Prisma.<FeatureSingular>WhereInput = { deletedAt: null };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.<feature-singular>.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.<feature-singular>.count({ where }),
    ]);
    return { items, total };
  }

  update(id: string, data: Prisma.<FeatureSingular>UpdateInput) {
    return this.prisma.<feature-singular>.update({ where: { id }, data });
  }

  async softDelete(id: string): Promise<boolean> {
    const res = await this.prisma.<feature-singular>.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return res.count > 0;
  }
}
```

## Checklist

- [ ] Method theo intent (`findActiveByUser`), KHÔNG generic `find(filter)`.
- [ ] Soft-delete: query lọc `deletedAt: null`.
- [ ] Trả `null` khi không tìm thấy (KHÔNG throw).
- [ ] Param `session?` / `tx?` cho transaction.
- [ ] Mongoose dùng `.lean()` khi không cần Document method.
- [ ] KHÔNG throw HttpException, KHÔNG có business logic.
