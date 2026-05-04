# DTO Pattern

## 4 loại DTO chuẩn

| DTO | Mục đích | File |
|---|---|---|
| Create | Body cho POST | `create-<feature>.dto.ts` |
| Update | Body cho PATCH | `update-<feature>.dto.ts` |
| Query | Query string cho GET list | `query-<feature>.dto.ts` |
| Response | Output trả client | `response-<feature>.dto.ts` |

## Create DTO

```ts
import { IsEmail, IsString, MinLength, MaxLength, Matches, IsOptional, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@/common/enums/role.enum';

export class CreateUserDto {
  @ApiProperty({ example: 'huy@gmail.com', description: 'Email người dùng (unique)' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email!: string;

  @ApiProperty({ minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8, { message: 'Mật khẩu tối thiểu 8 ký tự' })
  @MaxLength(72)
  @Matches(/(?=.*[A-Z])(?=.*\d)/, { message: 'Phải có chữ hoa và số' })
  password!: string;

  @ApiPropertyOptional({ maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) => value?.trim())
  fullName?: string;

  @ApiPropertyOptional({ enum: Role, default: Role.USER })
  @IsOptional()
  @IsEnum(Role)
  role?: Role = Role.USER;
}
```

## Update DTO (kế thừa Create)

```ts
import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

// Mọi field optional, trừ email không cho update qua endpoint này
export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['email', 'password'] as const),
) {}
```

## Query DTO (pagination + filter)

```ts
import { IsOptional, IsInt, Min, Max, IsString, IsEnum, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryUserDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({ default: 'createdAt' })
  @IsOptional()
  @IsString()
  @IsIn(['createdAt', 'updatedAt', 'email'])
  sortBy: string = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({ description: 'Tìm theo từ khoá email/tên' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
```

## Response DTO

```ts
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Exclude, Transform } from 'class-transformer';
import { Role } from '@/common/enums/role.enum';

export class UserResponseDto {
  @ApiProperty()
  @Expose()
  @Transform(({ obj }) => obj._id?.toString() ?? obj.id)
  id!: string;

  @ApiProperty()
  @Expose()
  email!: string;

  @ApiProperty()
  @Expose()
  fullName?: string;

  @ApiProperty({ enum: Role })
  @Expose()
  role!: Role;

  @ApiProperty()
  @Expose()
  createdAt!: Date;

  @ApiProperty()
  @Expose()
  updatedAt!: Date;

  @Exclude()
  password?: string;

  @Exclude()
  passwordHash?: string;
}
```

## Quy tắc

1. **Mỗi field có `@ApiProperty` / `@ApiPropertyOptional`** — Swagger doc đầy đủ.
2. **Validator + transformer cùng field** khi cần (sanitize trước, validate sau).
3. **`!` (definite assignment)** cho field bắt buộc khi `strictPropertyInitialization` bật.
4. **Default value** chỉ ở DTO, không ở service.
5. **Tách Request và Response DTO** — không trộn.
6. **`@Exclude` field nhạy cảm** ở Response DTO.
7. **Enum dùng class** từ `common/enums/`, không hard-code string union ở DTO.

## Mapping Document → Response DTO

```ts
// Cách 1: helper trong service
private toResponseDto(doc: UserDocument): UserResponseDto {
  return plainToInstance(UserResponseDto, doc.toObject(), {
    excludeExtraneousValues: true,
  });
}

// Cách 2: ClassSerializerInterceptor (global)
app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
```

## Anti-pattern

| ❌ Sai | ✅ Đúng |
|---|---|
| 1 DTO cho cả input + output | Tách Create/Update/Response |
| `password` xuất hiện ở Response DTO | `@Exclude()` |
| `@IsOptional() password: string` ở Update mà chấp nhận hash | Endpoint riêng `change-password` |
| DTO có method (`isAdmin()`) | DTO là plain data, logic ở service |
| Decorator validate ở schema thay vì DTO | Schema cho DB, DTO cho transport |
