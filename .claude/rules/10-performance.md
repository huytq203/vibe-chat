# 10 — Performance

## Triết lý

> Đo trước, tối ưu sau. **Premature optimization** là thiết kế sai. Tối ưu khi có metric chỉ ra hot spot.

## 🔴 R-PERF-01: Pagination bắt buộc

- Mọi list endpoint có `?page=&limit=` hoặc `?cursor=&limit=`.
- Default `limit=20`, max `limit=100`.
- KHÔNG return list không giới hạn.

## 🔴 R-PERF-02: Index DB

- Mọi query field có WHERE/SORT thường xuyên → index (xem rules/04).
- Compound index theo thứ tự sử dụng (equality → range → sort).
- Định kỳ chạy `db.collection.aggregate([{$indexStats: {}}])` xem index nào không dùng → drop.

## 🔴 R-PERF-03: N+1 query

- Tránh loop gọi DB. Dùng `populate` / `include` / `IN (...)`.
- Detect N+1: bật query log dev, hoặc dùng `mongoose-query-logger`.

```ts
// ❌ N+1
for (const m of messages) {
  m.author = await this.users.findById(m.authorId);
}

// ✅ Batch
const authorIds = messages.map(m => m.authorId);
const authors = await this.users.findByIds(authorIds);
const map = new Map(authors.map(a => [a.id, a]));
messages.forEach(m => m.author = map.get(m.authorId));
```

## 🔴 R-PERF-04: Async I/O parallel khi không phụ thuộc

```ts
// ❌ Tuần tự không cần thiết
const user = await this.users.findById(id);
const settings = await this.settings.findByUserId(id);

// ✅ Song song
const [user, settings] = await Promise.all([
  this.users.findById(id),
  this.settings.findByUserId(id),
]);
```

## 🟡 R-PERF-05: Cache theo level

| Level | Tool | Khi nào |
|---|---|---|
| In-memory (per instance) | `cache-manager` | Data ít thay đổi, scope nhỏ |
| Distributed | Redis | Share giữa instance, session, rate limit |
| CDN | Cloudflare/Cloudfront | Static asset, response GET public |

```ts
@CacheKey('user:profile')
@CacheTTL(60)  // giây
@Get(':id')
async findOne(@Param('id') id: string) {}
```

- Cache key theo `<resource>:<id>:<version>`.
- Invalidate khi mutation: `@CacheEvict` hoặc xoá manual.
- TTL ngắn (vài phút) cho data hay đổi, dài (1h+) cho data ổn định.

## 🟡 R-PERF-06: Lean / select field

- Mongoose: `.lean()` khi không cần Document method (nhanh hơn 3–5x).
- Chỉ select field cần dùng: `.select('email name')`.
- KHÔNG `SELECT *` trong SQL — explicit column.

## 🟡 R-PERF-07: Batch / bulk operation

- Insert nhiều: `insertMany` thay vì loop `create`.
- Update nhiều: `bulkWrite`.
- Tránh transaction lớn (> 1000 doc) → chia chunk.

## 🟡 R-PERF-08: Connection pool

- DB pool size: dev 10, staging 20, prod 50–100 (theo CPU + memory).
- Redis pool: 10–50.
- Theo dõi `pool.active` / `pool.waiting`.

## 🟡 R-PERF-09: Background job cho task nặng

- Gửi email, push notification, xử lý ảnh, gen thumbnail → đẩy vào queue (BullMQ/Redis).
- Endpoint trả `202 Accepted` ngay, KHÔNG block request.
- Worker riêng process queue.

## 🟡 R-PERF-10: Streaming cho file lớn

- Upload/download > 10MB → stream, không load toàn bộ vào memory.
- Dùng `fs.createReadStream` / `multer` `diskStorage`.

## 🟢 R-PERF-11: HTTP optimization

- Bật compression (`@nestjs/platform-express` + `compression`).
- ETag cho GET response.
- `Cache-Control` header cho static.

## 🟢 R-PERF-12: Profile khi cần

- `clinic.js` cho Node profiling.
- `0x` cho flame graph.
- DB: `EXPLAIN` (SQL) / `.explain('executionStats')` (Mongo).

## Anti-pattern thường gặp

| Anti-pattern | Cách fix |
|---|---|
| `for await` gọi DB từng item | `Promise.all` + batch |
| `await` trong forEach (forEach không hiểu Promise) | `for...of` hoặc `Promise.all(map)` |
| Sort/filter trong code thay vì DB | Đẩy về DB, có index |
| Log toàn bộ request body 1MB | Log selective field |
| Recompute mỗi request | Cache + invalidate |

## Cấm

- ❌ `findAll()` không limit.
- ❌ Nested loop DB query (N+1).
- ❌ `JSON.parse(JSON.stringify(obj))` để clone — dùng `structuredClone`.
- ❌ Đặt logic nặng trong middleware/guard chạy mỗi request.
