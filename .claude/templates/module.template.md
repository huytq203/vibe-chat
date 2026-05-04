# Template — `<feature>.module.ts`

```ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { <Feature>Controller } from './<feature>.controller';
import { <Feature>Service } from './<feature>.service';
import { <Feature>Repository } from './<feature>.repository';
import { <FeatureSingular>, <FeatureSingular>Schema } from './schemas/<feature-singular>.schema';

// Thêm import module phụ thuộc nếu có
// import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: <FeatureSingular>.name, schema: <FeatureSingular>Schema },
    ]),
    // UsersModule, // ← bỏ comment khi cần inject UsersService
  ],
  controllers: [<Feature>Controller],
  providers: [<Feature>Service, <Feature>Repository],
  exports: [<Feature>Service],
})
export class <Feature>Module {}
```

## Variant: Prisma (thay MongooseModule)

```ts
import { Module } from '@nestjs/common';

import { <Feature>Controller } from './<feature>.controller';
import { <Feature>Service } from './<feature>.service';
import { <Feature>Repository } from './<feature>.repository';
import { PrismaModule } from '@/database/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [<Feature>Controller],
  providers: [<Feature>Service, <Feature>Repository],
  exports: [<Feature>Service],
})
export class <Feature>Module {}
```

## Checklist

- [ ] Import schema/entity đúng đường dẫn.
- [ ] Khai báo `forFeature` cho Mongoose / inject Prisma.
- [ ] `controllers` đúng tên class.
- [ ] `providers` có cả Service và Repository.
- [ ] `exports` chỉ Service (KHÔNG export Repository).
- [ ] Đăng ký vào `app.module.ts`.
