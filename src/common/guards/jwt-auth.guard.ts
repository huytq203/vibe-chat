import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Observable } from 'rxjs';
import { ErrorCodes } from '../constants/error-codes';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    return super.canActivate(context);
  }

  handleRequest<TUser>(err: Error | null, user: TUser | false): TUser {
    if (err || !user) {
      throw new UnauthorizedException({
        code: ErrorCodes.AUTH_TOKEN_INVALID,
        message: 'Token không hợp lệ hoặc đã hết hạn, vui lòng đăng nhập lại',
      });
    }
    return user;
  }
}
