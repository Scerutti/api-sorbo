
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  ClassSerializerInterceptor,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RefreshGuard } from './guards/refresh.guard';
import { Public } from './decorators/public.decorator';
import { GetUser } from './decorators/get-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';
import { UserDto } from '../users/dto/user.dto';
import { plainToInstance } from 'class-transformer';
import {
  setRefreshTokenCookie,
  setAccessTokenCookie,
  clearRefreshTokenCookie,
  clearAccessTokenCookie,
  getRefreshTokenMaxAge,
  getAccessTokenMaxAge,
} from './utils/cookies';

@ApiTags('auth')
@Controller('auth')
@UseInterceptors(ClassSerializerInterceptor)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 intentos por minuto
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión' })
  @ApiResponse({ status: 200, description: 'Login exitoso', type: LoginResponseDto })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  async login(
    @Body() loginDto: LoginDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<LoginResponseDto> {
    const user = await this.authService.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const userAgent = request.headers['user-agent'];
    const ip = request.ip ?? request.socket?.remoteAddress;

    const { accessToken, refreshToken } = await this.authService.login(
      user,
      userAgent,
      ip,
    );

    // Establecer cookies HttpOnly para refreshToken y accessToken
    setRefreshTokenCookie(reply, refreshToken, getRefreshTokenMaxAge());
    setAccessTokenCookie(reply, accessToken, getAccessTokenMaxAge());

    // Mapear usuario a DTO
    const userPlain = user.toObject();
    const userDto = plainToInstance(
      UserDto,
      {
        ...userPlain,
        // Usar el name guardado en DB, o fallback a parte del email si no existe
        name: userPlain.name ?? userPlain.email.split('@')[0],
      },
      {
        excludeExtraneousValues: true,
      },
    );

    // También devolver accessToken en el body para compatibilidad con frontend
    // El frontend puede usar la cookie o el body, según prefiera
    return {
      accessToken,
      user: userDto,
    };
  }

  @Public()
  @Post('refresh')
  @UseGuards(RefreshGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renovar access token' })
  @ApiResponse({ status: 200, description: 'Token renovado', schema: { properties: { accessToken: { type: 'string' } } } })
  @ApiResponse({ status: 401, description: 'Refresh token inválido' })
  async refresh(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @GetUser() _user: UserDocument, // Guard valida y adjunta el usuario
  ): Promise<{ accessToken: string }> {
    // El guard ya validó el token y adjuntó el usuario
    const refreshToken = request.cookies?.refreshToken;
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token no proporcionado');
    }

    const userAgent = request.headers['user-agent'];
    const ip = request.ip ?? request.socket?.remoteAddress;

    const { accessToken, refreshToken: newRefreshToken } = await this.authService.refresh(
      refreshToken,
      userAgent,
      ip,
    );

    // Rotar cookies (refreshToken y accessToken)
    setRefreshTokenCookie(reply, newRefreshToken, getRefreshTokenMaxAge());
    setAccessTokenCookie(reply, accessToken, getAccessTokenMaxAge());

    // También devolver accessToken en el body para compatibilidad
    return { accessToken };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cerrar sesión' })
  @ApiResponse({ status: 204, description: 'Sesión cerrada' })
  async logout(
    @GetUser() user: UserDocument,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    const refreshToken = request.cookies?.refreshToken;
    if (refreshToken) {
      await this.authService.logout(String(user.id), refreshToken);
    }

    // Eliminar cookies (refreshToken y accessToken)
    clearRefreshTokenCookie(reply);
    clearAccessTokenCookie(reply);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Solicitar reset de contraseña' })
  @ApiResponse({ status: 200, description: 'Solicitud procesada' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
    await this.authService.requestPasswordReset(resetPasswordDto.email);
    return { message: 'Si el email existe, recibirás instrucciones para resetear tu contraseña' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Usuario autenticado', type: UserDto })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  getMe(@GetUser() user: UserDocument): { user: UserDto } {
    // Verificar si user es un documento de Mongoose o ya es un objeto plano
    const userPlain = user && typeof user.toObject === 'function' 
      ? user.toObject() 
      : user;
    
    const typedUserPlain = userPlain as unknown as {
      email?: string;
      name?: string;
    };
    
    const userDto = plainToInstance(
      UserDto,
      {
        ...userPlain,
        // Usar el name guardado en DB, o fallback a parte del email si no existe
        name: typedUserPlain.name ?? typedUserPlain.email?.split('@')[0] ?? typedUserPlain.email,
      },
      {
        excludeExtraneousValues: true,
      },
    );

    return { user: userDto };
  }
}

