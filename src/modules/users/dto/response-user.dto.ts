import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { User } from '@prisma/client';

export class ResponseUserDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  keycloakId!: string;

  @ApiProperty({ example: 'john_doe' })
  username!: string;

  @ApiPropertyOptional({ example: 'john@example.com' })
  email!: string | null;

  @ApiPropertyOptional({ example: '+84901234567' })
  phone!: string | null;

  @ApiProperty({ example: 'John Doe' })
  displayName!: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/avatar.jpg' })
  avatarUrl!: string | null;

  @ApiProperty({ example: 'ACTIVE' })
  status!: string;

  @ApiProperty({ example: false })
  isOnline!: boolean;

  @ApiPropertyOptional()
  lastSeenAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  static fromPrisma(user: User): ResponseUserDto {
    const dto = new ResponseUserDto();
    dto.id = user.id.toString(); // BigInt → string
    dto.keycloakId = user.keycloakId;
    dto.username = user.username;
    dto.email = user.email;
    dto.phone = user.phone;
    dto.displayName = user.displayName;
    dto.avatarUrl = user.avatarUrl;
    dto.status = user.status;
    dto.isOnline = user.isOnline;
    dto.lastSeenAt = user.lastSeenAt;
    dto.createdAt = user.createdAt;
    return dto;
  }
}
