import { ApiProperty } from '@nestjs/swagger';
import { ResponseUserDto } from '@/modules/users/dto/response-user.dto';

export class TokenDto {
  @ApiProperty({ example: 'eyJhbGci...' })
  accessToken!: string;

  @ApiProperty({
    example: '',
    description:
      'Refresh token được set qua HttpOnly cookie, field này luôn rỗng trong response',
  })
  refreshToken!: string;

  @ApiProperty({ example: 900 })
  expiresIn!: number;

  @ApiProperty({ example: 'Bearer' })
  tokenType!: string;
}

export class AuthResponseDto {
  @ApiProperty({ type: TokenDto })
  tokens!: TokenDto;

  @ApiProperty({ type: ResponseUserDto })
  user!: ResponseUserDto;
}
