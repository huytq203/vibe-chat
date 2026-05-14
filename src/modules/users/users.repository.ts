import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { UpsertUserPayload } from './interfaces/user.interface';
import type { User } from '@prisma/client';

@Injectable()
export class UsersRepository {
  private readonly logger = new Logger(UsersRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async findByKeycloakId(keycloakId: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { keycloakId } });
  }

  async findById(id: bigint): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { username } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async existsByUsername(username: string): Promise<boolean> {
    const count = await this.prisma.user.count({ where: { username } });
    return count > 0;
  }

  async existsByEmail(email: string): Promise<boolean> {
    const count = await this.prisma.user.count({ where: { email } });
    return count > 0;
  }

  /**
   * Upsert user từ Keycloak — gọi sau login/register để sync dữ liệu.
   * Tạo profile mặc định nếu chưa có.
   */
  async upsertFromKeycloak(payload: UpsertUserPayload): Promise<User> {
    const user = await this.prisma.user.upsert({
      where: { keycloakId: payload.keycloakId },
      update: {
        email: payload.email ?? undefined,
        displayName: payload.displayName,
        avatarUrl: payload.avatarUrl ?? undefined,
      },
      create: {
        keycloakId: payload.keycloakId,
        username: payload.username,
        email: payload.email,
        phone: payload.phone,
        displayName: payload.displayName,
        avatarUrl: payload.avatarUrl,
        profile: {
          create: {},
        },
      },
    });

    this.logger.log(`Upserted user keycloakId=${payload.keycloakId}`);
    return user;
  }

  async updateLastSeen(keycloakId: string): Promise<void> {
    await this.prisma.user.update({
      where: { keycloakId },
      data: { lastSeenAt: new Date(), isOnline: false },
    });
  }
}
