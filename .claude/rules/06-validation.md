# 06 — Validation

## Nguyên tắc

> Validate **ở biên** — DTO + Pipe. Bên trong service tin tưởng dữ liệu đã sạch. Mọi input từ ngoài (HTTP body, query, param, header) PHẢI qua DTO.

## 🔴 R-VAL-01: Mọi endpoint phải có DTO

- Body → `@Body() dto: CreateXxxDto`.
- Query → `@Query() dto: QueryXxxDto`.
- Param → `@Param('id', ParseUUIDPipe)` hoặc `@Param() dto: ParamXxxDto`.

KHÔNG nhận `@Body() body: any` hoặc `@Body() body: Record<string, unknown>`.

## 🔴 R-VAL-02: Global ValidationPipe

```ts
// main.ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,                    // Loại bỏ field không khai báo
    forbidNonWhitelisted: true,         // Throw nếu có field thừa
    transform: true,                    // Tự convert kiểu
    transformOptions: { enableImplicitConversion: true },
    stopAtFirstError: false,
  }),
);
```

## 🔴 R-VAL-03: DTO dùng class-validator + class-transformer

```ts
import { IsEmail, IsString, MinLength, IsOptional, MaxLength, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'huy@gmail.com' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Mật khẩu tối thiểu 8 ký tự' })
  @MaxLength(72, { message: 'Mật khẩu tối đa 72 ký tự' })
  @Matches(/(?=.*[A-Z])(?=.*\d)/, { message: 'Phải có chữ hoa và số' })
  password!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  fullName?: string;
}
```

## 🔴 R-VAL-04: Tách DTO theo intent

| DTO | Dùng cho |
|---|---|
| `CreateXxxDto` | POST /xxx |
| `UpdateXxxDto` | PATCH /xxx/:id (thường extends `PartialType(CreateXxxDto)`) |
| `QueryXxxDto` | GET /xxx?... — chứa filter, pagination |
| `ResponseXxxDto` | Output trả về client (mapping từ Document) |
| `ParamXxxDto` | Path param phức tạp |

## 🔴 R-VAL-05: Sanitize input

- Trim string: `@Transform(({ value }) => value?.trim())`.
- Lowercase email: `@Transform(({ value }) => value?.toLowerCase())`.
- Escape HTML cho field hiển thị (chống XSS): dùng `sanitize-html` ở service.
- KHÔNG cho phép field `password` xuất hiện ở `ResponseDto`.

## 🟡 R-VAL-06: PartialType / PickType / OmitType

Tận dụng các utility type của Swagger để DRY:

```ts
import { PartialType, OmitType } from '@nestjs/swagger';

export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['email'] as const),
) {}
```

## 🟡 R-VAL-07: Custom validator

Khi rule phức tạp (check unique trong DB, cross-field) → viết `ValidatorConstraint`.

```ts
@ValidatorConstraint({ async: true })
@Injectable()
export class IsEmailAvailableConstraint implements ValidatorConstraintInterface {
  constructor(private readonly users: UsersService) {}
  async validate(email: string) {
    return !(await this.users.existsByEmail(email));
  }
}

export const IsEmailAvailable = (options?: ValidationOptions) =>
  (object: object, propertyName: string) => {
    registerDecorator({ ... });
  };
```

> Lưu ý: validator async cần `useContainer(app.select(AppModule), { fallbackOnErrors: true })` ở `main.ts`.

## 🟡 R-VAL-08: Validate environment variable

`ConfigModule.forRoot({ validationSchema: Joi.object({...}) })` — fail fast khi thiếu env.

## 🟢 R-VAL-09: Validate response (optional, dev mode)

Bật `class-transformer` `ClassSerializerInterceptor` + `@Expose`/`@Exclude` để strip field nhạy cảm.

```ts
@Exclude()
password!: string;

@Expose()
@Transform(({ obj }) => obj._id.toString())
id!: string;
```

## Cấm

- ❌ Validate trong service / controller bằng tay (`if (!email) throw ...`) khi đã có decorator.
- ❌ Trộn DTO request và response (1 class cho cả input lẫn output).
- ❌ DTO chứa logic / method.
- ❌ DTO không có `@ApiProperty` → Swagger thiếu doc.
