
import {
  Injectable,
  Logger,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { UsersService } from '../users/users.service';
import { User, UserDocument } from '../users/schemas/user.schema';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { TokenPair } from './interfaces/token-pair.interface';

const REFRESH_TOKEN_SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async validateUser(email: string, password: string): Promise<UserDocument | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  async login(
    user: UserDocument,
    userAgent?: string,
    ip?: string,
  ): Promise<TokenPair> {
    const payload: JwtPayload = {
      sub: String(user.id),
      email: user.email,
      roles: user.roles,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.generateRefreshToken();
    const tokenHash = await this.hashRefreshToken(refreshToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.getRefreshTokenDays());

    const refreshTokenSnapshot: {
      tokenHash: string;
      expiresAt: Date;
      createdAt: Date;
      userAgent?: string;
      ip?: string;
    } = {
      tokenHash,
      expiresAt,
      createdAt: new Date(),
      ...(userAgent ? { userAgent } : {}),
      ...(ip ? { ip } : {}),
    };

    user.refreshTokens.push(refreshTokenSnapshot);

    await user.save();

    this.logger.log(`Usuario ${user.email} inició sesión`);

    return { accessToken, refreshToken };
  }

  async refresh(refreshToken: string, userAgent?: string, ip?: string): Promise<TokenPair> {
    const user = await this.findUserByRefreshToken(refreshToken);
    if (!user) {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    // Encontrar y eliminar el token usado
    let tokenFound = false;
    const validTokens = [];

    for (const rt of user.refreshTokens) {
      if (rt.expiresAt < new Date()) {
        continue; // Saltar expirados
      }

      const isMatch = await this.compareRefreshToken(rt.tokenHash, refreshToken);
      if (isMatch) {
        tokenFound = true;
        continue; // No incluir el token usado
      }

      validTokens.push(rt);
    }

    if (!tokenFound) {
      throw new UnauthorizedException('Refresh token no encontrado');
    }

    user.refreshTokens = validTokens;
    await user.save();

    // Generar nuevos tokens
    return this.login(user, userAgent, ip);
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    const user = await this.usersService.findOneDocument(userId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Eliminar el refresh token específico y limpiar expirados
    const validTokens = [];

    for (const rt of user.refreshTokens) {
      if (rt.expiresAt < new Date()) {
        continue; // Saltar expirados
      }

      const isMatch = await this.compareRefreshToken(rt.tokenHash, refreshToken);
      if (!isMatch) {
        validTokens.push(rt); // Mantener solo los que NO son el token a eliminar
      }
    }

    user.refreshTokens = validTokens;
    await user.save();

    this.logger.log(`Usuario ${user.email} cerró sesión`);
  }

  async validateRefreshToken(refreshToken: string): Promise<UserDocument | null> {
    return this.findUserByRefreshToken(refreshToken);
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      // Por seguridad, no revelamos si el email existe o no
      this.logger.warn(`Intento de reset de password para email inexistente: ${email}`);
      return;
    }

    // Por ahora solo logueamos. En producción, aquí iría la lógica de generación
    // de token de reset y envío de email con enlace para resetear contraseña.
    this.logger.log(`Solicitud de reset de password para: ${email}`);
  }

  private async findUserByRefreshToken(refreshToken: string): Promise<UserDocument | null> {
    const users = await this.userModel
      .find({ 'refreshTokens.tokenHash': { $exists: true } })
      .exec();

    for (const user of users) {
      for (const rt of user.refreshTokens) {
        if (rt.expiresAt < new Date()) {
          continue; // Token expirado
        }

        const isValid = await this.compareRefreshToken(rt.tokenHash, refreshToken);
        if (isValid) {
          return user;
        }
      }
    }

    return null;
  }

  private generateRefreshToken(): string {
    return randomBytes(64).toString('hex');
  }

  private async hashRefreshToken(token: string): Promise<string> {
    return bcrypt.hash(token, REFRESH_TOKEN_SALT_ROUNDS);
  }

  private async compareRefreshToken(hash: string, token: string): Promise<boolean> {
    return bcrypt.compare(token, hash);
  }

  private getRefreshTokenDays(): number {
    const expires = this.configService.get<string>('JWT_REFRESH_EXPIRES', '7d');
    const regex = /(\d+)d/;
    const match = regex.exec(expires);
    return match ? parseInt(match[1], 10) : 7;
  }
}

