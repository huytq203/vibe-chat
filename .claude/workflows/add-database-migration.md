# Workflow: Thêm Database Migration

> Áp dụng khi đổi schema: thêm field, đổi type, thêm/đổi index, đổi tên collection.

## Quy tắc vàng

1. **Migration phải reversible** khi có thể (có `up` và `down`).
2. **Migration idempotent** — chạy 2 lần không sai.
3. **Backward compatible 1 step** — release N+1 đọc được data của release N. Đừng break đột ngột.
4. **Test migration trên staging** trước khi prod.
5. **Backup** trước khi run prod migration nặng.

## Quy trình chuẩn

### Bước 1: Plan thay đổi

| Loại thay đổi | Strategy |
|---|---|
| Thêm field optional | Thêm trực tiếp, default null |
| Thêm field bắt buộc | 2 phase: (1) thêm optional + backfill, (2) đổi sang required |
| Đổi tên field | 3 phase: (1) thêm field mới đọc cả 2, (2) backfill, (3) xoá field cũ |
| Đổi type | Dual-write: app ghi cả 2, đọc field mới có fallback |
| Drop field/collection | Đảm bảo không còn code dùng → release N+1 mới drop |
| Thêm index | Background index cho prod (không block) |

### Bước 2: Tạo file migration

#### Prisma

```bash
npx prisma migrate dev --name add_users_phone_field
```

→ Sinh file trong `prisma/migrations/<ts>_<name>/migration.sql`. Review trước khi commit.

#### TypeORM

```bash
npx typeorm migration:generate ./src/database/migrations/AddUserPhone -d ./data-source.ts
```

#### Mongoose (custom script)

Tạo file `src/database/migrations/2026-05-04-add-user-phone.ts`:

```ts
import { Connection } from 'mongoose';

export const name = '2026-05-04-add-user-phone';

export async function up(conn: Connection): Promise<void> {
  await conn.collection('users').updateMany(
    { phone: { $exists: false } },
    { $set: { phone: null } },
  );
  await conn.collection('users').createIndex({ phone: 1 }, { sparse: true });
}

export async function down(conn: Connection): Promise<void> {
  await conn.collection('users').updateMany({}, { $unset: { phone: '' } });
  await conn.collection('users').dropIndex('phone_1');
}
```

### Bước 3: Cập nhật schema/entity code

- Mongoose: thêm field vào `*.schema.ts`.
- Prisma: file đã sinh, review.
- TypeORM: thêm `@Column()` vào entity.

### Bước 4: Cập nhật DTO

- Add field vào `CreateXxxDto`/`UpdateXxxDto` với validator.
- Add vào `ResponseXxxDto` với `@ApiProperty`.

### Bước 5: Cập nhật Repository / Service

- Repo method nếu cần query field mới.
- Service xử lý field (validate uniqueness, format).

### Bước 6: Test migration

```bash
# Dev
npm run migrate:up
npm run migrate:down  # verify reversible
npm run migrate:up

# Test trên dump prod
mongorestore --uri="<staging>" prod-dump/
npm run migrate:up
```

### Bước 7: Deploy

| Môi trường | Bước |
|---|---|
| Dev | Auto chạy khi start |
| Staging | Pipeline chạy migration trước deploy app |
| Prod | (1) Backup → (2) Run migration → (3) Smoke test → (4) Deploy app |

### Bước 8: Theo dõi

- Log migration: tên, thời gian start/end, số doc affected.
- Alert nếu migration > X phút (lock collection).

## Checklist trước khi merge

- [ ] Migration có `up` và `down`.
- [ ] Đã test reversible.
- [ ] Có backfill cho data cũ (nếu thêm field bắt buộc).
- [ ] Index dùng `background: true` (Mongo) cho prod.
- [ ] Không drop field còn code đang dùng.
- [ ] Đã update schema, DTO, repo, service đồng bộ.
- [ ] Test passes.
- [ ] Document trong PR: lý do, impact, rollback plan.

## Cấm

- ❌ `synchronize: true` (TypeORM) ngoài dev.
- ❌ Migration chạy raw SQL không có dry-run.
- ❌ Drop column/collection cùng release với code mới.
- ❌ Migration block table > 100 nghìn dòng mà không có chunk.
- ❌ Không backup trước migration đụng vào prod data.
