# Guard Pattern

## Vai trò

> Guard quyết định **request có được vào endpoint hay không**. Authentication + Authorization. Chạy sau middleware, trước interceptor và pipe.

## JWT Auth Guard

```ts
// common/guards/jwt-auth.guard.ts
import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }

  handleRequest<TUser = any>(err: unknown, user: TUser) {
    if (err || !user) {
      throw new UnauthorizedException({
        code: 'AUTH_TOKEN_INVALID',
        message: 'Token không hợp lệ hoặc đã hết hạn',
      });
    }
    return user;
  }
}
```

## Public decorator (skip auth)

```ts
// common/decorators/public.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

## Roles Guard

```ts
// common/guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../enums/role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException({
        code: 'ROLE_FORBIDDEN',
        message: 'Bạn không có quyền truy cập tài nguyên này',
      });
    }
    return true;
  }
}
```

## Roles decorator

```ts
// common/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { Role } from '../enums/role.enum';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
```

## Ownership Guard (resource-level)

```ts
// modules/messages/guards/message-owner.guard.ts
@Injectable()
export class MessageOwnerGuard implements CanActivate {
  constructor(private readonly service: MessagesService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const messageId = req.params.id;
    const userId = req.user?.id;

    const msg = await this.service.findOneRaw(messageId);
    if (!msg) throw new NotFoundException({ code: 'MESSAGE_NOT_FOUND' });
    if (msg.authorId !== userId) {
      throw new ForbiddenException({ code: 'MESSAGE_NOT_OWNED' });
    }
    return true;
  }
}
```

## Áp dụng

```ts
// Global (main.ts)
app.useGlobalGuards(new JwtAuthGuard(app.get(Reflector)));

// Controller-level
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')

// Method-level
@Patch(':id')
@Roles(Role.ADMIN)
@UseGuards(MessageOwnerGuard)
update() {}

// Bypass auth
@Public()
@Get('health')
health() {}
```

## Quy tắc

1. **Order**: `JwtAuthGuard` → `RolesGuard` → `<ResourceGuard>`. Auth trước, authorization sau.
2. **Throw kèm `code`** để FE phân biệt 401 do hết token vs token sai.
3. **Lấy user từ `req.user`** — populate trong `JwtStrategy.validate()`.
4. **Guard không có business logic** ngoài check quyền.
5. **Test guard riêng** — đừng phụ thuộc service nặng.

## Anti-pattern

| ❌ Sai | ✅ Đúng |
|---|---|
| Check role trong service | `@Roles()` + `RolesGuard` |
| Guard query nhiều DB call | Cache hoặc đẩy logic xuống service |
| Guard set field vào `req.body` | Dùng interceptor hoặc service |
| Throw `Error` thường | Throw `UnauthorizedException`/`ForbiddenException` |
| Bật/tắt guard bằng `if(env)` | Dùng `@Public()` decorator |
