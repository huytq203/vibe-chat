import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'john_doe', minLength: 3, maxLength: 50 })
  @IsString({ message: 'Username phải là chuỗi ký tự' })
  @MinLength(3, { message: 'Username tối thiểu 3 ký tự' })
  @MaxLength(50, { message: 'Username tối đa 50 ký tự' })
  @Matches(/^[a-zA-Z0-9_.-]+$/, {
    message: 'Username chỉ được chứa chữ, số, dấu _ . -',
  })
  @Transform(({ value }: { value: string }) => value?.trim().toLowerCase())
  username!: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @Transform(({ value }: { value: string }) => value?.trim().toLowerCase())
  email!: string;

  @ApiProperty({ example: 'Password123', minLength: 6, maxLength: 72 })
  @IsString()
  @MinLength(6, { message: 'Mật khẩu tối thiểu 6 ký tự' })
  @MaxLength(72, { message: 'Mật khẩu tối đa 72 ký tự' })
  @Matches(/(?=.*[A-Z])(?=.*\d)/, {
    message: 'Mật khẩu phải có ít nhất 1 chữ hoa và 1 số',
  })
  password!: string;

  @ApiPropertyOptional({ example: 'John Doe', maxLength: 100 })
  @IsOptional()
  @IsString({ message: 'Tên hiển thị phải là chuỗi ký tự' })
  @MaxLength(100, { message: 'Tên hiển thị tối đa 100 ký tự' })
  @Transform(({ value }: { value: string }) => value?.trim())
  displayName?: string;

  @ApiPropertyOptional({ example: '0901234567', maxLength: 20 })
  @IsOptional()
  @IsString({ message: 'Số điện thoại phải là chuỗi ký tự' })
  @MaxLength(20, { message: 'Số điện thoại tối đa 20 ký tự' })
  @MinLength(11, { message: 'Số điện thoại tối thiểu 11 ký tự' })
  @Transform(({ value }: { value: string }) => value?.trim())
  phone?: string;
}
