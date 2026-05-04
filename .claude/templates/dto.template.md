# Template — DTO files

> Mỗi module có 4 DTO. Tách thư mục `dto/` riêng cho từng entity nếu module có nhiều entity con.

## `dto/create-<feature-singular>.dto.ts`

```ts
import {
  IsString, IsNotEmpty, IsOptional, MaxLength, MinLength, IsEnum,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class Create<FeatureSingular>Dto {
  @ApiProperty({ description: 'Tiêu đề', maxLength: 200 })
  @IsString()
  @IsNotEmpty({ message: 'Tiêu đề không được rỗng' })
  @MaxLength(200)
  @Transform(({ value }) => value?.trim())
  title!: string;

  @ApiPropertyOptional({ description: 'Mô tả', maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  @Transform(({ value }) => value?.trim())
  description?: string;

  // Thêm field theo schema
}
```

## `dto/update-<feature-singular>.dto.ts`

```ts
import { PartialType, OmitType } from '@nestjs/swagger';
import { Create<FeatureSingular>Dto } from './create-<feature-singular>.dto';

// Mọi field optional. Có thể OmitType để chặn field không cho update.
export class Update<FeatureSingular>Dto extends PartialType(Create<FeatureSingular>Dto) {}

// Variant: chặn 1 số field
// export class Update<FeatureSingular>Dto extends PartialType(
//   OmitType(Create<FeatureSingular>Dto, ['ownerId'] as const),
// ) {}
```

## `dto/query-<feature-singular>.dto.ts`

```ts
import { IsOptional, IsInt, Min, Max, IsString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class Query<FeatureSingular>Dto {
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

  @ApiPropertyOptional({
    default: 'createdAt',
    enum: ['createdAt', 'updatedAt'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['createdAt', 'updatedAt'])
  sortBy: string = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({ description: 'Tìm theo từ khoá' })
  @IsOptional()
  @IsString()
  q?: string;
}
```

## `dto/response-<feature-singular>.dto.ts`

```ts
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';

export class <FeatureSingular>ResponseDto {
  @ApiProperty()
  @Expose()
  @Transform(({ obj }) => obj._id?.toString() ?? obj.id)
  id!: string;

  @ApiProperty()
  @Expose()
  title!: string;

  @ApiProperty({ required: false })
  @Expose()
  description?: string;

  @ApiProperty()
  @Expose()
  ownerId!: string;

  @ApiProperty()
  @Expose()
  createdAt!: Date;

  @ApiProperty()
  @Expose()
  updatedAt!: Date;
}
```

## Checklist

- [ ] Mọi field có `@ApiProperty` / `@ApiPropertyOptional`.
- [ ] Validator phù hợp (`@IsEmail`, `@IsString`, `@IsEnum`, ...).
- [ ] Transformer cho sanitize (`trim`, `toLowerCase`).
- [ ] Default value chỉ ở Query DTO.
- [ ] Response DTO có `@Expose` cho field cần hiện, `@Exclude` cho password/secret.
- [ ] KHÔNG trộn 1 DTO cho input + output.
- [ ] KHÔNG có method/business logic trong DTO.
