# Template — `<feature>.controller.ts`

```ts
import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Role } from '@/common/enums/role.enum';
import { ParseObjectIdPipe } from '@/common/pipes/parse-object-id.pipe';

import { <Feature>Service } from './<feature>.service';
import { Create<FeatureSingular>Dto } from './dto/create-<feature-singular>.dto';
import { Update<FeatureSingular>Dto } from './dto/update-<feature-singular>.dto';
import { Query<FeatureSingular>Dto } from './dto/query-<feature-singular>.dto';
import { <FeatureSingular>ResponseDto } from './dto/response-<feature-singular>.dto';

@ApiTags('<feature>')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: '<feature>', version: '1' })
export class <Feature>Controller {
  constructor(private readonly service: <Feature>Service) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo <feature> mới' })
  @ApiResponse({ status: 201, type: <FeatureSingular>ResponseDto })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: Create<FeatureSingular>Dto,
  ): Promise<<FeatureSingular>ResponseDto> {
    return this.service.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách <feature> (có phân trang)' })
  @ApiResponse({ status: 200 })
  list(@Query() query: Query<FeatureSingular>Dto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết 1 <feature>' })
  @ApiParam({ name: 'id', description: 'ID của <feature>' })
  @ApiResponse({ status: 200, type: <FeatureSingular>ResponseDto })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  findOne(
    @Param('id', ParseObjectIdPipe) id: string,
  ): Promise<<FeatureSingular>ResponseDto> {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật <feature>' })
  @ApiResponse({ status: 200, type: <FeatureSingular>ResponseDto })
  update(
    @CurrentUser('id') userId: string,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: Update<FeatureSingular>Dto,
  ): Promise<<FeatureSingular>ResponseDto> {
    return this.service.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.ADMIN, Role.MODERATOR)
  @ApiOperation({ summary: 'Xoá <feature> (admin/mod)' })
  @ApiResponse({ status: 204 })
  remove(@Param('id', ParseObjectIdPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }
}
```

## Checklist

- [ ] `@ApiTags` + `@ApiBearerAuth`.
- [ ] `@UseGuards` ở class level (auth bắt buộc) — endpoint public dùng `@Public()`.
- [ ] Mỗi method có `@ApiOperation` + tối thiểu 1 `@ApiResponse`.
- [ ] `@HttpCode` cho POST(201) và DELETE(204).
- [ ] `@CurrentUser('id')` thay vì lấy từ body.
- [ ] Pipe parse cho path param (`ParseObjectIdPipe`/`ParseUUIDPipe`/`ParseIntPipe`).
- [ ] Method 1 dòng — KHÔNG có business logic.
