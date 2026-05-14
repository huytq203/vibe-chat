import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '@/modules/users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { KeycloakService } from './keycloak.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' }), UsersModule],
  controllers: [AuthController],
  providers: [AuthService, KeycloakService, JwtStrategy],
  exports: [KeycloakService, JwtStrategy],
})
export class AuthModule {}
