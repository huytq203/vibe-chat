import { Injectable, NotFoundException } from '@nestjs/common';
import { ErrorCodes } from '@/common/constants/error-codes';
import { ResponseUserDto } from './dto/response-user.dto';
import { UsersRepository } from './users.repository';
import type { UpsertUserPayload } from './interfaces/user.interface';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepo: UsersRepository) {}

  async findByKeycloakIdOrThrow(keycloakId: string): Promise<ResponseUserDto> {
    const user = await this.usersRepo.findByKeycloakId(keycloakId);
    if (!user) {
      throw new NotFoundException({
        code: ErrorCodes.USER_NOT_FOUND,
        message: 'Không tìm thấy người dùng',
      });
    }
    return ResponseUserDto.fromPrisma(user);
  }

  async upsertFromKeycloak(
    payload: UpsertUserPayload,
  ): Promise<ResponseUserDto> {
    const user = await this.usersRepo.upsertFromKeycloak(payload);
    return ResponseUserDto.fromPrisma(user);
  }

  async existsByUsername(username: string): Promise<boolean> {
    return this.usersRepo.existsByUsername(username);
  }

  async existsByEmail(email: string): Promise<boolean> {
    return this.usersRepo.existsByEmail(email);
  }
}
