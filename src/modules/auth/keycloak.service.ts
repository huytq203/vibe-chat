import {
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ErrorCodes } from '@/common/constants/error-codes';
import type {
  KeycloakTokenResponse,
  KeycloakUserRepresentation,
} from './interfaces/keycloak-token.interface';

@Injectable()
export class KeycloakService {
  private readonly logger = new Logger(KeycloakService.name);
  private readonly baseUrl: string;
  private readonly realm: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly tokenEndpoint: string;
  private readonly adminBaseUrl: string;

  // Cache admin token in-memory — refresh trước hạn 30s để tránh edge case
  private adminTokenCache: { token: string; expiresAt: number } | null = null;
  private static readonly ADMIN_TOKEN_BUFFER_MS = 30_000;

  constructor(configService: ConfigService) {
    this.baseUrl = configService
      .getOrThrow<string>('KEYCLOAK_BASE_URL')
      .replace(/\/$/, '');
    this.realm = configService.getOrThrow<string>('KEYCLOAK_REALM');
    this.clientId = configService.getOrThrow<string>('KEYCLOAK_CLIENT_ID');
    this.clientSecret = configService.getOrThrow<string>(
      'KEYCLOAK_CLIENT_SECRET',
    );
    this.tokenEndpoint = `${this.baseUrl}/realms/${this.realm}/protocol/openid-connect/token`;
    this.adminBaseUrl = `${this.baseUrl}/admin/realms/${this.realm}`;
  }

  // ── Public Methods ─────────────────────────────────────────────────

  async login(
    username: string,
    password: string,
  ): Promise<KeycloakTokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'password',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      username,
      password,
      scope: 'openid profile email',
    });

    const response = await this.post<KeycloakTokenResponse>(
      this.tokenEndpoint,
      body,
    );

    if (!response.ok) {
      const err: Record<string, unknown> = await (
        response.json() as Promise<Record<string, unknown>>
      ).catch(() => ({}));
      this.logger.warn(
        `Login failed for user=${username}: ${JSON.stringify(err)}`,
      );
      throw new UnauthorizedException({
        code: ErrorCodes.AUTH_CREDENTIALS_INVALID,
        message: 'Sai tên đăng nhập hoặc mật khẩu',
      });
    }

    return response.json() as Promise<KeycloakTokenResponse>;
  }

  async refreshToken(refreshToken: string): Promise<KeycloakTokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: refreshToken,
    });

    const response = await this.post<KeycloakTokenResponse>(
      this.tokenEndpoint,
      body,
    );

    if (!response.ok) {
      throw new UnauthorizedException({
        code: ErrorCodes.AUTH_REFRESH_TOKEN_INVALID,
        message: 'Refresh token không hợp lệ hoặc đã hết hạn',
      });
    }

    return response.json() as Promise<KeycloakTokenResponse>;
  }

  async logout(refreshToken: string): Promise<void> {
    const logoutEndpoint = `${this.baseUrl}/realms/${this.realm}/protocol/openid-connect/logout`;
    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: refreshToken,
    });

    const response = await this.post<void>(logoutEndpoint, body);

    if (!response.ok && response.status !== 204) {
      this.logger.warn(`Logout failed: status=${response.status}`);
      // Không throw — logout nên luôn thành công ở phía client
    }
  }

  /**
   * Tạo user trong Keycloak qua Admin REST API.
   * Client cần có Service Account với role manage-users.
   */
  async registerUser(params: {
    username: string;
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }): Promise<string> {
    const adminToken = await this.getAdminToken();

    // Tạo user — chỉ gửi firstName/lastName khi có giá trị non-empty
    // (Keycloak User Profile validation reject empty string khi field required)
    const userPayload: Record<string, unknown> = {
      username: params.username,
      email: params.email,
      enabled: true,
      emailVerified: false,
    };
    const firstName = params.firstName?.trim();
    const lastName = params.lastName?.trim();
    if (firstName) userPayload.firstName = firstName;
    if (lastName) userPayload.lastName = lastName;

    const createRes = await fetch(`${this.adminBaseUrl}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(userPayload),
    });

    if (createRes.status === 409) {
      throw new ConflictException({
        code: ErrorCodes.USER_USERNAME_TAKEN,
        message: 'Username hoặc email đã được sử dụng',
      });
    }

    if (!createRes.ok) {
      const rawText = await createRes.text().catch(() => '');
      this.logger.error(
        `Create Keycloak user failed: status=${createRes.status} body=${rawText} payload=${JSON.stringify(userPayload)}`,
      );
      throw new ServiceUnavailableException({
        code: ErrorCodes.AUTH_REGISTER_FAILED,
        message: 'Không thể tạo tài khoản, vui lòng thử lại',
      });
    }

    // Lấy Keycloak user ID từ Location header
    const location = createRes.headers.get('Location') ?? '';
    const keycloakId = location.split('/').at(-1) ?? '';

    if (!keycloakId) {
      throw new ServiceUnavailableException({
        code: ErrorCodes.AUTH_REGISTER_FAILED,
        message: 'Không thể xác định ID tài khoản sau khi tạo',
      });
    }

    // Đặt password
    await this.setPassword(keycloakId, params.password, adminToken);

    return keycloakId;
  }

  // ── Private Helpers ────────────────────────────────────────────────

  private async getAdminToken(): Promise<string> {
    // Cache hit + chưa sát hạn → reuse
    if (
      this.adminTokenCache &&
      this.adminTokenCache.expiresAt - Date.now() >
        KeycloakService.ADMIN_TOKEN_BUFFER_MS
    ) {
      return this.adminTokenCache.token;
    }

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    const response = await this.post<KeycloakTokenResponse>(
      this.tokenEndpoint,
      body,
    );

    if (!response.ok) {
      throw new ServiceUnavailableException({
        code: ErrorCodes.AUTH_KEYCLOAK_UNAVAILABLE,
        message: 'Không thể kết nối với máy chủ xác thực',
      });
    }

    const data = (await response.json()) as KeycloakTokenResponse;
    this.adminTokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
    return data.access_token;
  }

  private async setPassword(
    keycloakId: string,
    password: string,
    adminToken: string,
  ): Promise<void> {
    const res = await fetch(
      `${this.adminBaseUrl}/users/${keycloakId}/reset-password`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          type: 'password',
          value: password,
          temporary: false,
        }),
      },
    );

    if (!res.ok) {
      this.logger.error(
        `Set password failed for keycloakId=${keycloakId}: status=${res.status}`,
      );
      throw new ServiceUnavailableException({
        code: ErrorCodes.AUTH_REGISTER_FAILED,
        message: 'Không thể thiết lập mật khẩu',
      });
    }
  }

  /**
   * Xoá user Keycloak — dùng cho rollback khi register fail giữa chừng.
   * Best-effort: không throw, chỉ log nếu fail.
   */
  async deleteUser(keycloakId: string): Promise<void> {
    try {
      const adminToken = await this.getAdminToken();
      const res = await fetch(`${this.adminBaseUrl}/users/${keycloakId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!res.ok && res.status !== 404) {
        this.logger.error(
          `Rollback delete Keycloak user failed: keycloakId=${keycloakId}, status=${res.status}`,
        );
      } else {
        this.logger.warn(`Rolled back Keycloak user: keycloakId=${keycloakId}`);
      }
    } catch (err) {
      this.logger.error(
        `Rollback delete exception: keycloakId=${keycloakId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  async getUserById(
    keycloakId: string,
    adminToken?: string,
  ): Promise<KeycloakUserRepresentation> {
    const token = adminToken ?? (await this.getAdminToken());
    const res = await fetch(`${this.adminBaseUrl}/users/${keycloakId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new ServiceUnavailableException({
        code: ErrorCodes.AUTH_KEYCLOAK_UNAVAILABLE,
        message: 'Không thể lấy thông tin người dùng từ Keycloak',
      });
    }

    return res.json() as Promise<KeycloakUserRepresentation>;
  }

  private post<T>(
    url: string,
    body: URLSearchParams,
  ): Promise<Response & { json(): Promise<T> }> {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  }
}
