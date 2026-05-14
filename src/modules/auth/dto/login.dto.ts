import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'john_doe',
    description: 'Username hoặc email Keycloak',
  })
  @IsString({ message: 'Username không được để trống' })
  username!: string;

  @ApiProperty({ example: 'Password123' })
  @IsString({ message: 'Mật khẩu không được để trống' })
  @MinLength(1, { message: 'Mật khẩu không được để trống' })
  password!: string;
}
