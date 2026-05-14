import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ErrorCodes } from '@/common/constants/error-codes';
import { UsersRepository } from '@/modules/users/users.repository';
import type { KeycloakJwtPayload } from '../interfaces/keycloak-token.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersRepo: UsersRepository,
  ) {
    const keycloakBaseUrl = configService
      .getOrThrow<string>('KEYCLOAK_BASE_URL')
      .replace(/\/$/, '');
    const realm = configService.getOrThrow<string>('KEYCLOAK_REALM');
    const issuer = `${keycloakBaseUrl}/realms/${realm}`;
    const clientId = configService.getOrThrow<string>('KEYCLOAK_CLIENT_ID');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      algorithms: ['RS256'],
      // Tự động fetch public key từ Keycloak JWKS endpoint, cache 10 phút
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri: `${issuer}/protocol/openid-connect/certs`,
      }),
      ignoreExpiration: false,
      issuer,
      audience: [clientId, 'base-tech'],
    });
  }

  /**
   * Verify thêm: user tồn tại trong DB và status = ACTIVE.
   * Chặn case JWT hợp lệ nhưng user đã bị ban/xoá.
   */
  async validate(payload: KeycloakJwtPayload): Promise<KeycloakJwtPayload> {
    if (!payload.sub) {
      throw new UnauthorizedException({
        code: ErrorCodes.AUTH_TOKEN_INVALID,
        message: 'Token thiếu thông tin định danh',
      });
    }

    const user = await this.usersRepo.findByKeycloakId(payload.sub);
    if (!user || user.deletedAt) {
      throw new UnauthorizedException({
        code: ErrorCodes.USER_NOT_FOUND,
        message: 'Tài khoản không tồn tại',
      });
    }

    if (user.status === 'BANNED') {
      throw new ForbiddenException({
        code: ErrorCodes.USER_BANNED,
        message: 'Tài khoản đã bị khoá',
      });
    }

    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException({
        code: ErrorCodes.FORBIDDEN,
        message: 'Tài khoản chưa kích hoạt hoặc đã ngừng hoạt động',
      });
    }

    return payload;
  }
}
