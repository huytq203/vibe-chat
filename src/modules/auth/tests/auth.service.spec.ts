/* eslint-disable @typescript-eslint/unbound-method */
import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { ResponseUserDto } from '@/modules/users/dto/response-user.dto';
import { UsersService } from '@/modules/users/users.service';
import { AuthService } from '../auth.service';
import type { AuthResponseDto } from '../dto/auth-response.dto';
import type { LoginDto } from '../dto/login.dto';
import type { RefreshTokenDto } from '../dto/refresh-token.dto';
import type { KeycloakTokenResponse } from '../interfaces/keycloak-token.interface';
import { KeycloakService } from '../keycloak.service';

// JWT với payload { sub, preferred_username, email, name, iat, exp }
const MOCK_ACCESS_TOKEN =
  'eyJhbGciOiJSUzI1NiJ9.' +
  Buffer.from(
    JSON.stringify({
      sub: 'kc-uuid-1234',
      preferred_username: 'john_doe',
      email: 'john@example.com',
      name: 'John Doe',
      iat: 1000,
      exp: 9999999999,
    }),
  ).toString('base64url') +
  '.signature';

const MOCK_TOKEN_RESPONSE: KeycloakTokenResponse = {
  access_token: MOCK_ACCESS_TOKEN,
  refresh_token: 'refresh-token-mock',
  expires_in: 900,
  refresh_expires_in: 604800,
  token_type: 'Bearer',
  session_state: 'session-1',
  scope: 'openid profile email',
};

const MOCK_USER: ResponseUserDto = {
  id: '1',
  keycloakId: 'kc-uuid-1234',
  username: 'john_doe',
  email: 'john@example.com',
  phone: null,
  displayName: 'John Doe',
  avatarUrl: null,
  status: 'ACTIVE',
  isOnline: false,
  lastSeenAt: null,
  createdAt: new Date('2026-01-01'),
};

describe('AuthService', () => {
  let authService: AuthService;
  let keycloakSvc: jest.Mocked<KeycloakService>;
  let usersSvc: jest.Mocked<UsersService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: KeycloakService,
          useValue: {
            login: jest.fn(),
            refreshToken: jest.fn(),
            logout: jest.fn(),
            registerUser: jest.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: {
            upsertFromKeycloak: jest.fn(),
            findByKeycloakIdOrThrow: jest.fn(),
          },
        },
      ],
    }).compile();

    authService = module.get(AuthService);
    keycloakSvc = module.get(KeycloakService);
    usersSvc = module.get(UsersService);
  });

  describe('login', () => {
    it('nên trả về tokens + user khi credentials hợp lệ', async () => {
      // Arrange
      keycloakSvc.login.mockResolvedValue(MOCK_TOKEN_RESPONSE);
      usersSvc.upsertFromKeycloak.mockResolvedValue(MOCK_USER);

      // Act
      const dto: LoginDto = { username: 'john_doe', password: 'Password123' };
      const result: AuthResponseDto = await authService.login(dto);

      // Assert
      expect(result.tokens.accessToken).toBe(MOCK_TOKEN_RESPONSE.access_token);
      expect(result.tokens.refreshToken).toBe(
        MOCK_TOKEN_RESPONSE.refresh_token,
      );
      expect(result.tokens.expiresIn).toBe(900);
      expect(result.user.keycloakId).toBe('kc-uuid-1234');
      expect(keycloakSvc.login).toHaveBeenCalledWith('john_doe', 'Password123');
      expect(usersSvc.upsertFromKeycloak).toHaveBeenCalledWith(
        expect.objectContaining({
          keycloakId: 'kc-uuid-1234',
          username: 'john_doe',
        }),
      );
    });

    it('nên throw UnauthorizedException khi Keycloak từ chối credentials', async () => {
      // Arrange
      keycloakSvc.login.mockRejectedValue(
        new UnauthorizedException({
          code: 'AUTH_CREDENTIALS_INVALID',
          message: 'Sai mật khẩu',
        }),
      );

      // Act & Assert
      const dto: LoginDto = { username: 'john_doe', password: 'wrong' };
      await expect(authService.login(dto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('refresh', () => {
    it('nên trả về token mới khi refresh token hợp lệ', async () => {
      // Arrange
      keycloakSvc.refreshToken.mockResolvedValue(MOCK_TOKEN_RESPONSE);

      // Act
      const dto: RefreshTokenDto = { refreshToken: 'valid-refresh-token' };
      const result = await authService.refresh(dto);

      // Assert
      expect(result.accessToken).toBe(MOCK_TOKEN_RESPONSE.access_token);
      expect(keycloakSvc.refreshToken).toHaveBeenCalledWith(
        'valid-refresh-token',
      );
    });

    it('nên throw UnauthorizedException khi refresh token không hợp lệ', async () => {
      // Arrange
      keycloakSvc.refreshToken.mockRejectedValue(
        new UnauthorizedException({
          code: 'AUTH_REFRESH_TOKEN_INVALID',
          message: 'Token hết hạn',
        }),
      );

      // Act & Assert
      const dto: RefreshTokenDto = { refreshToken: 'expired-token' };
      await expect(authService.refresh(dto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('nên gọi keycloakSvc.logout với refreshToken', async () => {
      // Arrange
      keycloakSvc.logout.mockResolvedValue(undefined);

      // Act
      await authService.logout('my-refresh-token');

      // Assert
      expect(keycloakSvc.logout).toHaveBeenCalledWith('my-refresh-token');
    });
  });

  describe('getMe', () => {
    it('nên trả về user từ DB theo keycloakId trong JWT payload', async () => {
      // Arrange
      usersSvc.findByKeycloakIdOrThrow.mockResolvedValue(MOCK_USER);

      // Act
      const result = await authService.getMe({
        sub: 'kc-uuid-1234',
        preferred_username: 'john_doe',
        iat: 1000,
        exp: 9999999999,
      });

      // Assert
      expect(result.keycloakId).toBe('kc-uuid-1234');
      expect(usersSvc.findByKeycloakIdOrThrow).toHaveBeenCalledWith(
        'kc-uuid-1234',
      );
    });
  });
});
