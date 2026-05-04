# Template — `<feature>.service.ts`

```ts
import {
  Injectable, Logger, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import { <Feature>Repository } from './<feature>.repository';
import { Create<FeatureSingular>Dto } from './dto/create-<feature-singular>.dto';
import { Update<FeatureSingular>Dto } from './dto/update-<feature-singular>.dto';
import { Query<FeatureSingular>Dto } from './dto/query-<feature-singular>.dto';
import { <FeatureSingular>ResponseDto } from './dto/response-<feature-singular>.dto';
import { <FeatureSingular>Document } from './schemas/<feature-singular>.schema';

@Injectable()
export class <Feature>Service {
  private readonly logger = new Logger(<Feature>Service.name);

  constructor(private readonly repo: <Feature>Repository) {}

  async create(
    userId: string,
    dto: Create<FeatureSingular>Dto,
  ): Promise<<FeatureSingular>ResponseDto> {
    const created = await this.repo.create({ ...dto, ownerId: userId });
    this.logger.log(`Tạo <feature> ${created.id} bởi user ${userId}`);
    return this.toResponseDto(created);
  }

  async findAll(query: Query<FeatureSingular>Dto) {
    const { items, total } = await this.repo.findPaginated(query);
    return {
      data: items.map((it) => this.toResponseDto(it)),
      meta: this.buildMeta(query.page, query.limit, total),
    };
  }

  async findOne(id: string): Promise<<FeatureSingular>ResponseDto> {
    const doc = await this.repo.findById(id);
    if (!doc) {
      throw new NotFoundException({
        code: '<FEATURE>_NOT_FOUND',
        message: `Không tìm thấy <feature> với id ${id}`,
      });
    }
    return this.toResponseDto(doc);
  }

  async update(
    userId: string,
    id: string,
    dto: Update<FeatureSingular>Dto,
  ): Promise<<FeatureSingular>ResponseDto> {
    const doc = await this.repo.findById(id);
    if (!doc) {
      throw new NotFoundException({ code: '<FEATURE>_NOT_FOUND' });
    }
    if (doc.ownerId !== userId) {
      throw new ForbiddenException({
        code: '<FEATURE>_NOT_OWNED',
        message: 'Bạn không có quyền chỉnh sửa tài nguyên này',
      });
    }
    const updated = await this.repo.update(id, dto);
    if (!updated) {
      throw new NotFoundException({ code: '<FEATURE>_NOT_FOUND' });
    }
    return this.toResponseDto(updated);
  }

  async remove(id: string): Promise<void> {
    const ok = await this.repo.softDelete(id);
    if (!ok) {
      throw new NotFoundException({ code: '<FEATURE>_NOT_FOUND' });
    }
    this.logger.log(`Đã xoá <feature> ${id}`);
  }

  // ── private helpers ────────────────────────────────────────
  private toResponseDto(doc: <FeatureSingular>Document): <FeatureSingular>ResponseDto {
    return plainToInstance(
      <FeatureSingular>ResponseDto,
      typeof (doc as any).toObject === 'function' ? (doc as any).toObject() : doc,
      { excludeExtraneousValues: true },
    );
  }

  private buildMeta(page: number, limit: number, total: number) {
    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    };
  }
}
```

## Checklist

- [ ] `Logger` private readonly với context = class name.
- [ ] Constructor inject Repository (và service module khác qua exports).
- [ ] Mỗi method public có return type explicit.
- [ ] Throw `Exception` kèm `code` + `message` tiếng Việt.
- [ ] Validate ownership cho action mutate.
- [ ] Log `info` cho action chính.
- [ ] Map Document → Response DTO trước khi return.
- [ ] KHÔNG truy cập `req`, `res`, header, cookie.
