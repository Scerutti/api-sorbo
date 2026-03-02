
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import csrfProtection from '@fastify/csrf-protection';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  const contentSecurityPolicy = process.env.NODE_ENV === 'production' ? {} : false;

  await app.register(helmet, {
    global: true,
    crossOriginResourcePolicy: { policy: "cross-origin"},
    contentSecurityPolicy: contentSecurityPolicy
  });

  // Configurar CORS según el entorno
  const isDevelopment = process.env.NODE_ENV === 'development';
  const commonCorsConfig = {
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With', 'Range'
    ],
    exposedHeaders: ['Content-Disposition'],
  };


  await app.register(cors, {
    ...commonCorsConfig,
    origin: (origin, callback) => {
      if (isDevelopment) {
        // En dev aceptamos localhost
        if (!origin || origin.includes('localhost')) {
          callback(null, true);
          return;
        }
      } else {
        // En prod leemos de la variable
        const allowedOrigins = (process.env.CORS_ORIGINS ?? '').split(',').map(o => o.trim()).filter(Boolean);
        if (allowedOrigins.includes(`${origin}`) || allowedOrigins.length === 0) {
          callback(null, true);
          return;
        }
      }
      callback(null, false);
    },
  });

  const cookieSecret = process.env.COOKIE_SECRET;
  await app.register(cookie, cookieSecret ? { secret: cookieSecret } : {});

  await app.register(rateLimit, {
    max: Number(process.env.RATE_LIMIT_MAX ?? 100),
    timeWindow: process.env.RATE_LIMIT_WINDOW ?? '1 minute',
    allowList: [],
    keyGenerator: (req) => {
      const ip = req.ip ?? req.socket?.remoteAddress;
      return ip ?? 'anonymous';
    },
  });

  if (process.env.ENABLE_CSRF === 'true') {
    await app.register(csrfProtection);
  }

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.setGlobalPrefix('api', { exclude: ['/'] });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const port = Number(process.env.PORT ?? 3001);
  const host = process.env.HOST ?? '0.0.0.0';

  await app.listen({
    port,
    host,
  });

  Logger.log(`API server listening on port ${port}`, 'Bootstrap');
}

void bootstrap();
