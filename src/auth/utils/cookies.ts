
import type { FastifyReply } from 'fastify';

export interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  path: string;
  maxAge: number;
}

export function setRefreshTokenCookie(
  reply: FastifyReply,
  refreshToken: string,
  maxAgeSeconds: number,
): void {
  const isProduction = process.env.NODE_ENV === 'production';

  reply.setCookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/api/v1/auth',
    maxAge: maxAgeSeconds,
  });
}

export function setAccessTokenCookie(
  reply: FastifyReply,
  accessToken: string,
  maxAgeSeconds: number,
): void {
  const isProduction = process.env.NODE_ENV === 'production';

  reply.setCookie('accessToken', accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/api',
    maxAge: maxAgeSeconds,
  });
}

export function clearRefreshTokenCookie(reply: FastifyReply): void {
  reply.clearCookie('refreshToken', {
    path: '/api/v1/auth',
  });
}

export function clearAccessTokenCookie(reply: FastifyReply): void {
  reply.clearCookie('accessToken', {
    path: '/api',
  });
}

export function getRefreshTokenMaxAge(): number {
  const expires = process.env.JWT_REFRESH_EXPIRES ?? '7d';
  const regex = /(\d+)d/;
  const match = regex.exec(expires);
  const days = match ? parseInt(match[1], 10) : 7;
  return days * 24 * 60 * 60; // Convertir a segundos
}

export function getAccessTokenMaxAge(): number {
  const expires = process.env.JWT_ACCESS_EXPIRES ?? '15m';
  // Parsear formato como '15m', '1h', '30m', etc.
  const regex = /(\d+)([mhd])/;
  const match = regex.exec(expires);
  if (!match) {
    return 15 * 60; // Default 15 minutos en segundos
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 'm':
      return value * 60; // minutos a segundos
    case 'h':
      return value * 60 * 60; // horas a segundos
    case 'd':
      return value * 24 * 60 * 60; // días a segundos
    default:
      return 15 * 60;
  }
}

export function parseRefreshTokenExpiration(): number {
  return getRefreshTokenMaxAge();
}

