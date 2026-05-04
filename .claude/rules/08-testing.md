# 08 — Testing

## Triết lý

> **Test pyramid:** unit (70%) > integration (20%) > e2e (10%).
> **Coverage tối thiểu:** Service 80%, Controller 60%, tổng dự án ≥ 70%.
> Test phải **chạy nhanh** (< 5s/file unit) và **deterministic** (không phụ thuộc thời gian/random).

## Phân loại

| Loại | Phạm vi | Mock | Tốc độ |
|---|---|---|---|
| Unit | 1 class (service, helper) | Mock mọi dependency | < 1s |
| Integration | Module + DB thật (in-memory hoặc test container) | Mock external API | 1–5s |
| E2E | Full app qua HTTP | Mock external API | 5–30s |

## 🔴 R-TEST-01: Cấu trúc AAA

```ts
it('nên trả về user khi tìm theo id', async () => {
  // Arrange
  const userId = 'u_1';
  const mockUser = { id: userId, email: 'a@b.com' };
  jest.spyOn(repo, 'findById').mockResolvedValue(mockUser);

  // Act
  const result = await service.findOne(userId);

  // Assert
  expect(result).toEqual(expect.objectContaining({ id: userId }));
  expect(repo.findById).toHaveBeenCalledWith(userId);
});
```

## 🔴 R-TEST-02: Tên test mô tả hành vi

- Format: `nên <kết quả mong đợi> khi <điều kiện>`.
- KHÔNG: `should work`, `test 1`, `findOne returns user`.
- ✅: `nên throw NotFoundException khi user không tồn tại`.

## 🔴 R-TEST-03: 1 test = 1 hành vi

- 1 `it()` test 1 thứ. Nhiều assertion liên quan cùng 1 hành vi thì OK.
- Test fail → biết ngay vấn đề ở đâu.

## 🔴 R-TEST-04: Mock đúng mức

- Service test: mock Repository, mock các Service khác.
- Repository test: dùng DB thật (in-memory MongoDB hoặc SQLite/Postgres test container).
- KHÔNG mock cái mình đang test.

## 🔴 R-TEST-05: Test cả happy path lẫn edge case

Mỗi service method tối thiểu có:
- ✅ Happy path
- ❌ Input invalid → throw
- ❌ Resource not found → throw
- ❌ Concurrency / race nếu có

## 🟡 R-TEST-06: Test data builder

Dùng factory để tạo fixture, tránh duplicate:

```ts
// tests/factories/user.factory.ts
export const buildUser = (overrides?: Partial<User>): User => ({
  id: 'u_1',
  email: 'test@example.com',
  password: 'hashed',
  createdAt: new Date('2026-01-01'),
  ...overrides,
});
```

## 🟡 R-TEST-07: E2E test

```ts
describe('POST /api/v1/users (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
  });

  afterAll(() => app.close());

  it('nên tạo user và trả 201', () => {
    return request(app.getHttpServer())
      .post('/api/v1/users')
      .send({ email: 'a@b.com', password: 'Password123' })
      .expect(201)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.data.email).toBe('a@b.com');
      });
  });
});
```

## 🟡 R-TEST-08: Cleanup

- `afterEach`: clear mock, clear DB collection liên quan.
- `afterAll`: close app, close DB connection.
- KHÔNG để 1 test ảnh hưởng test khác.

## 🟡 R-TEST-09: Time-dependent test

- Mock `Date.now()` qua `jest.useFakeTimers()`.
- KHÔNG dựa vào `new Date()` thật trong assertion.

## 🟢 R-TEST-10: Snapshot test

- Chỉ dùng cho output structure ổn định (response DTO shape).
- Snapshot phải commit + review khi update.

## Convention file

- Đặt cạnh source: `users.service.ts` ↔ `users.service.spec.ts` HOẶC trong `tests/`.
- E2E: `test/<feature>.e2e-spec.ts`.

## Cấm

- ❌ Test phụ thuộc internet / external API thật.
- ❌ `setTimeout` / `sleep` để chờ async — dùng `await` đúng.
- ❌ Test có biến global state giữa các `it`.
- ❌ Comment-out test thay vì `it.skip` (và TODO fix).
- ❌ Coverage 100% bằng test rỗng — coverage phải có assertion thật.
