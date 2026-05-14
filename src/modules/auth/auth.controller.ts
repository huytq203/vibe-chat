import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { ErrorCodes } from '@/common/constants/error-codes';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { ResponseUserDto } from '@/modules/users/dto/response-user.dto';
import { AuthService } from './auth.service';
import { AuthResponseDto, TokenDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import type { KeycloakJwtPayload } from './interfaces/keycloak-token.interface';

const REFRESH_COOKIE = 'refresh_token';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authSvc: AuthService,
    private readonly configSvc: ConfigService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Đăng ký tài khoản mới' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    description: 'Đăng ký thành công',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 409, description: 'Username hoặc email đã tồn tại' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.authSvc.register(dto);
    this.setRefreshCookie(
      res,
      result.tokens.refreshToken,
      result.tokens.expiresIn,
    );
    return this.stripRefreshToken(result);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Đăng nhập' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Đăng nhập thành công',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Sai tên đăng nhập hoặc mật khẩu' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.authSvc.login(dto);
    this.setRefreshCookie(
      res,
      result.tokens.refreshToken,
      result.tokens.expiresIn,
    );
    return this.stripRefreshToken(result);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Làm mới access token (refresh token đọc từ cookie)',
  })
  @ApiResponse({ status: 200, description: 'Token mới', type: TokenDto })
  @ApiResponse({ status: 401, description: 'Refresh token không hợp lệ' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Omit<TokenDto, 'refreshToken'>> {
    const refreshToken = this.extractRefreshCookie(req);
    const tokens = await this.authSvc.refresh({ refreshToken });
    this.setRefreshCookie(res, tokens.refreshToken, tokens.expiresIn);
    return {
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
      tokenType: tokens.tokenType,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Đăng xuất — clear refresh cookie + revoke session',
  })
  @ApiResponse({ status: 204, description: 'Đăng xuất thành công' })
  @ApiResponse({ status: 401, description: 'Token không hợp lệ' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const refreshToken = this.tryExtractRefreshCookie(req);
    if (refreshToken) {
      await this.authSvc.logout(refreshToken);
    }
    this.clearRefreshCookie(res);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy thông tin người dùng hiện tại' })
  @ApiResponse({
    status: 200,
    description: 'Thông tin user',
    type: ResponseUserDto,
  })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  getMe(@CurrentUser() user: KeycloakJwtPayload): Promise<ResponseUserDto> {
    return this.authSvc.getMe(user);
  }

  // ── Helpers ────────────────────────────────────────────────────────

  private setRefreshCookie(
    res: Response,
    token: string,
    accessExpiresIn: number,
  ): void {
    const isProd = this.configSvc.get<string>('NODE_ENV') === 'production';
    // Refresh token TTL ≥ access token TTL; mặc định 7 ngày
    const maxAgeMs = Math.max(accessExpiresIn * 1000, 7 * 24 * 60 * 60 * 1000);
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict',
      path: '/api',
      maxAge: maxAgeMs,
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(REFRESH_COOKIE, { path: '/api' });
  }

  private extractRefreshCookie(req: Request): string {
    const token = this.tryExtractRefreshCookie(req);
    if (!token) {
      throw new UnauthorizedException({
        code: ErrorCodes.AUTH_REFRESH_TOKEN_INVALID,
        message: 'Thiếu refresh token, vui lòng đăng nhập lại',
      });
    }
    return token;
  }

  private tryExtractRefreshCookie(req: Request): string | undefined {
    const cookies = req.cookies as Record<string, string> | undefined;
    return cookies?.[REFRESH_COOKIE];
  }

  private stripRefreshToken(result: AuthResponseDto): AuthResponseDto {
    return {
      ...result,
      tokens: { ...result.tokens, refreshToken: '' },
    };
  }
}
