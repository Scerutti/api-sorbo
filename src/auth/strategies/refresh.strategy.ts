
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { FastifyRequest } from 'fastify';
import { AuthService } from '../auth.service';
import { UserDocument } from '../../users/schemas/user.schema';

@Injectable()
export class RefreshStrategy extends PassportStrategy(Strategy, 'refresh') {
  constructor(private readonly authService: AuthService) {
    super((req: FastifyRequest, done: (error: Error | null, user?: UserDocument) => void) => {
      this.validate(req)
        .then((user) => done(null, user))
        .catch((error) => done(error));
    });
  }

  async validate(req: FastifyRequest): Promise<UserDocument> {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token no proporcionado');
    }

    const user = await this.authService.validateRefreshToken(refreshToken);
    if (!user) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    return user;
  }
}

