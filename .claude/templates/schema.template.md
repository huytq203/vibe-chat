# Template — Schema / Entity

## Mongoose schema

`schemas/<feature-singular>.schema.ts`

```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type <FeatureSingular>Document = HydratedDocument<<FeatureSingular>>;

@Schema({
  collection: '<feature>',          // tên collection số nhiều, snake_case
  timestamps: true,                 // tự thêm createdAt, updatedAt
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret) => {
      ret.id = ret._id?.toString();
      delete ret._id;
      return ret;
    },
  },
})
export class <FeatureSingular> {
  @Prop({ type: String, required: true, trim: true, maxlength: 200, index: true })
  title!: string;

  @Prop({ type: String, default: null, maxlength: 5000 })
  description?: string | null;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  ownerId!: Types.ObjectId;

  @Prop({ type: Date, default: null, index: true })
  deletedAt?: Date | null;

  // createdAt, updatedAt được Mongoose auto-add do timestamps: true
  createdAt!: Date;
  updatedAt!: Date;
}

export const <FeatureSingular>Schema = SchemaFactory.createForClass(<FeatureSingular>);

// Compound index theo pattern truy vấn thường dùng
<FeatureSingular>Schema.index({ ownerId: 1, createdAt: -1 });
<FeatureSingular>Schema.index({ deletedAt: 1, createdAt: -1 });
```

## Prisma model

`prisma/schema.prisma`

```prisma
model <FeatureSingular> {
  id          String    @id @default(cuid())
  title       String    @db.VarChar(200)
  description String?   @db.Text
  ownerId     String
  owner       User      @relation(fields: [ownerId], references: [id])
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?

  @@index([ownerId, createdAt(sort: Desc)])
  @@index([deletedAt])
  @@map("<feature>")
}
```

## TypeORM entity

`entities/<feature-singular>.entity.ts`

```ts
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Index,
} from 'typeorm';

@Entity('<feature>')
@Index(['ownerId', 'createdAt'])
export class <FeatureSingular> {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'uuid' })
  @Index()
  ownerId!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt!: Date | null;
}
```

## Checklist

- [ ] Có `createdAt`, `updatedAt`, `deletedAt`.
- [ ] Field bắt buộc đánh dấu `required: true` / non-optional.
- [ ] String có `maxlength` rõ ràng.
- [ ] Reference field có `index: true`.
- [ ] Compound index theo query pattern thực tế.
- [ ] Tên collection/table snake_case số nhiều.
- [ ] `toJSON.transform` map `_id` → `id`, xoá `__v` (Mongoose).
- [ ] Field nhạy cảm có chiến lược ẩn ở Response DTO (`@Exclude`).
