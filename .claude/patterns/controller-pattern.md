# Controller Pattern

## Vai trò

> Controller là **adapter HTTP** — nhận request, gọi service, trả response. KHÔNG chứa business logic.

## Mẫu chuẩn

```ts
import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Role } from '@/common/enums/role.enum';
import { ParseObjectIdPipe } from '@/common/pipes/parse-object-id.pipe';

import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { QueryMessageDto } from './dto/query-message.dto';
import { MessageResponseDto } from './dto/response-message.dto';

@ApiTags('messages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'messages', version: '1' })
export class MessagesController {
  constructor(private readonly service: MessagesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo tin nhắn mới' })
  @ApiResponse({ status: 201, type: MessageResponseDto })
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateMessageDto,
  ): Promise<MessageResponseDto> {
    return this.service.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tin nhắn' })
  list(@Query() query: QueryMessageDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết 1 tin nhắn' })
  findOne(@Param('id', ParseObjectIdPipe) id: string): Promise<MessageResponseDto> {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật tin nhắn' })
  update(
    @CurrentUser('id') userId: string,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateMessageDto,
  ): Promise<MessageResponseDto> {
    return this.service.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.ADMIN, Role.MODERATOR)
  @ApiOperation({ summary: 'Xoá tin nhắn (admin)' })
  remove(@Param('id', ParseObjectIdPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }
}
```

## Quy tắc

1. **Constructor inject `service`** — KHÔNG inject Repository/Model trực tiếp.
2. **Method 1 dòng** chuyển tiếp xuống service. Nếu logic > 3 dòng → đẩy vào service.
3. **Decorator order**: HTTP method → status code → swagger → guard → param.
4. **Param decorator dùng pipe**: `ParseObjectIdPipe`, `ParseIntPipe`, `ParseUUIDPipe`.
5. **Mọi endpoint có Swagger decorator** (`@ApiOperation`, `@ApiResponse`).
6. **Lấy user từ `@CurrentUser()`** — KHÔNG nhận `userId` từ body/query.

## Custom decorator

```ts
// common/decorators/current-user.decorator.ts
export const CurrentUser = createParamDecorator(
  (field: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    return field ? req.user?.[field] : req.user;
  },
);
```

## Anti-pattern

| ❌ Sai | ✅ Đúng |
|---|---|
| `if (user.role !== 'admin') throw...` | `@Roles(Role.ADMIN)` + RolesGuard |
| `await this.userModel.findById(id)` | `this.service.findOne(id)` |
| `@Body() body: any` | `@Body() dto: CreateXxxDto` |
| `return res.json(...)` (dùng `@Res()`) | `return data` (Nest tự serialize) |
| Try/catch wrap mọi method | Để filter global handle |
| `@Get('users')` lặp prefix module | `@Controller('users')` |
