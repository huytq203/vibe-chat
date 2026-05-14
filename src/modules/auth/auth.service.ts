import { Injectable, Logger } from '@nestjs/common';
import { ResponseUserDto } from '@/modules/users/dto/response-user.dto';
import { UsersService } from '@/modules/users/users.service';
import { AuthResponseDto, TokenDto } from './dto/auth-response.dto';
import type { LoginDto } from './dto/login.dto';
import type { RefreshTokenDto } from './dto/refresh-token.dto';
import type { RegisterDto } from './dto/register.dto';
import type {
  KeycloakJwtPayload,
  KeycloakTokenResponse,
} from './interfaces/keycloak-token.interface';
import { KeycloakService } from './keycloak.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly keycloakSvc: KeycloakService,
    private readonly usersSvc: UsersService,
  ) {}

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const tokens = await this.keycloakSvc.login(dto.username, dto.password);
    const payload = this.decodeJwt(tokens.access_token);

    const user = await this.usersSvc.upsertFromKeycloak({
      keycloakId: payload.sub,
      username: payload.preferred_username,
      email: payload.email,
      displayName: payload.name ?? payload.preferred_username,
    });

    this.logger.log(`Login thành công: username=${payload.preferred_username}`);

    return {
      tokens: this.mapTokens(tokens),
      user,
    };
  }

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const nameParts = (dto.displayName ?? dto.username).trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || '';

    const keycloakId = await this.keycloakSvc.registerUser({
      username: dto.username,
      email: dto.email,
      password: dto.password,
      firstName,
      lastName,
    });

    this.logger.log(
      `Registered Keycloak user: username=${dto.username}, keycloakId=${keycloakId}`,
    );

    // Compensating rollback: nếu login/sync DB fail → xoá user vừa tạo ở Keycloak
    try {
      const tokens = await this.keycloakSvc.login(dto.username, dto.password);
      const payload = this.decodeJwt(tokens.access_token);

      const user = await this.usersSvc.upsertFromKeycloak({
        keycloakId: payload.sub,
        username: dto.username,
        email: dto.email,
        phone: dto.phone,
        displayName: dto.displayName ?? dto.username,
      });

      this.logger.log(
        `Register + sync DB thành công: username=${dto.username}`,
      );

      return {
        tokens: this.mapTokens(tokens),
        user,
      };
    } catch (err) {
      this.logger.error(
        `Register flow fail sau khi tạo Keycloak user, đang rollback: keycloakId=${keycloakId}`,
        err instanceof Error ? err.stack : String(err),
      );
      await this.keycloakSvc.deleteUser(keycloakId);
      throw err;
    }
  }

  async refresh(dto: RefreshTokenDto): Promise<TokenDto> {
    const tokens = await this.keycloakSvc.refreshToken(dto.refreshToken);
    return this.mapTokens(tokens);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.keycloakSvc.logout(refreshToken);
    this.logger.log('Logout thành công');
  }

  async getMe(payload: KeycloakJwtPayload): Promise<ResponseUserDto> {
    return this.usersSvc.findByKeycloakIdOrThrow(payload.sub);
  }

  // ── Helpers ────────────────────────────────────────────────────────

  private decodeJwt(token: string): KeycloakJwtPayload {
    const [, payloadB64] = token.split('.');
    const json = Buffer.from(payloadB64, 'base64url').toString('utf8');
    return JSON.parse(json) as KeycloakJwtPayload;
  }

  private mapTokens(kc: KeycloakTokenResponse): TokenDto {
    return {
      accessToken: kc.access_token,
      refreshToken: kc.refresh_token,
      expiresIn: kc.expires_in,
      tokenType: kc.token_type,
    };
  }
}
