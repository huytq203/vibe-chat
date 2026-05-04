# Template — Test files

## Unit test cho Service

`tests/<feature>.service.spec.ts`

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

import { <Feature>Service } from '../<feature>.service';
import { <Feature>Repository } from '../<feature>.repository';

describe('<Feature>Service', () => {
  let service: <Feature>Service;
  let repo: jest.Mocked<<Feature>Repository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        <Feature>Service,
        {
          provide: <Feature>Repository,
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            findPaginated: jest.fn(),
            update: jest.fn(),
            softDelete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(<Feature>Service);
    repo = module.get(<Feature>Repository);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('nên tạo mới và trả về Response DTO', async () => {
      const dto = { title: 'A' };
      const userId = 'u_1';
      const created = { _id: 'id_1', title: 'A', ownerId: userId, createdAt: new Date(), updatedAt: new Date() };
      repo.create.mockResolvedValue(created as any);

      const result = await service.create(userId, dto as any);

      expect(repo.create).toHaveBeenCalledWith({ ...dto, ownerId: userId });
      expect(result).toEqual(expect.objectContaining({ id: 'id_1', title: 'A' }));
    });
  });

  describe('findOne', () => {
    it('nên trả về DTO khi tìm thấy', async () => {
      repo.findById.mockResolvedValue({ _id: 'id_1', title: 'A' } as any);
      const result = await service.findOne('id_1');
      expect(result.id).toBe('id_1');
    });

    it('nên throw NotFoundException khi không tồn tại', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.findOne('id_x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('nên throw Forbidden khi không phải chủ sở hữu', async () => {
      repo.findById.mockResolvedValue({ _id: 'id_1', ownerId: 'u_2' } as any);
      await expect(service.update('u_1', 'id_1', { title: 'B' } as any))
        .rejects.toThrow(ForbiddenException);
    });

    it('nên cập nhật thành công khi là chủ', async () => {
      repo.findById.mockResolvedValue({ _id: 'id_1', ownerId: 'u_1' } as any);
      repo.update.mockResolvedValue({ _id: 'id_1', title: 'B', ownerId: 'u_1' } as any);

      const result = await service.update('u_1', 'id_1', { title: 'B' } as any);
      expect(result.title).toBe('B');
    });
  });

  describe('remove', () => {
    it('nên xoá mềm thành công', async () => {
      repo.softDelete.mockResolvedValue(true);
      await expect(service.remove('id_1')).resolves.toBeUndefined();
    });

    it('nên throw NotFound khi không tồn tại', async () => {
      repo.softDelete.mockResolvedValue(false);
      await expect(service.remove('id_x')).rejects.toThrow(NotFoundException);
    });
  });
});
```

## E2E test

`test/<feature>.e2e-spec.ts`

```ts
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';

describe('<Feature> (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    // Login để lấy token
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'Password123' });
    token = res.body.data.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/<feature>', () => {
    it('nên tạo thành công và trả 201', () =>
      request(app.getHttpServer())
        .post('/api/v1/<feature>')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Test' })
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.title).toBe('Test');
        }));

    it('nên trả 400 khi thiếu title', () =>
      request(app.getHttpServer())
        .post('/api/v1/<feature>')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400)
        .expect((res) => {
          expect(res.body.error.code).toBe('VALIDATION_ERROR');
        }));

    it('nên trả 401 khi không có token', () =>
      request(app.getHttpServer())
        .post('/api/v1/<feature>')
        .send({ title: 'Test' })
        .expect(401));
  });
});
```

## Test factory (fixture builder)

`tests/factories/<feature-singular>.factory.ts`

```ts
import { <FeatureSingular> } from '../../schemas/<feature-singular>.schema';

export const build<FeatureSingular> = (overrides?: Partial<<FeatureSingular>>): <FeatureSingular> => ({
  title: 'Default title',
  description: null,
  ownerId: 'user_1' as any,
  deletedAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
} as <FeatureSingular>);
```

## Checklist

- [ ] Mock đúng dependency của target (KHÔNG mock target).
- [ ] Tên test bằng tiếng Việt: `nên <kết quả> khi <điều kiện>`.
- [ ] Mỗi method tối thiểu: happy path + 1 error path.
- [ ] `afterEach` clear mock; `afterAll` close app/connection.
- [ ] E2E có cleanup data sau test.
- [ ] KHÔNG dùng `setTimeout` chờ async.
- [ ] Test deterministic (mock thời gian / random nếu cần).
