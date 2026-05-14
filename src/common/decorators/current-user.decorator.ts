import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { KeycloakJwtPayload } from '@/modules/auth/interfaces/keycloak-token.interface';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): KeycloakJwtPayload => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user: KeycloakJwtPayload }>();
    return request.user;
  },
);
