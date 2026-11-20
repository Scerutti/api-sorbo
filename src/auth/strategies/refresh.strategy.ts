
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { FastifyRequest } from 'fastify';
import { AuthService } from '../auth.service';
import { UserDocument } from '../../users/schemas/user.schema';

@Injectable()
export class RefreshStrategy extends PassportStrategy(Strategy, 'refresh') {
  // PassportStrategy de Nest ya le pasa a passport-custom un callback que
  // llama a validate(req) y resuelve done(). Pasarle uno propio era redundante
  // y no tipaba: el mixin no acepta argumentos para esta estrategia.
  constructor(private readonly authService: AuthService) {
    super();
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

