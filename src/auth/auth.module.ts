import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule, ThrottlerModuleOptions } from '@nestjs/throttler';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RefreshStrategy } from './strategies/refresh.strategy';
import { User, UserSchema } from '../users/schemas/user.schema';

const throttlerConfig = ThrottlerModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (configService: ConfigService): ThrottlerModuleOptions => ({
    throttlers: [
      {
        ttl: Number(configService.get('RATE_LIMIT_DURATION', 60)),
        limit: Number(configService.get('RATE_LIMIT_POINTS', 5)),
      },
    ],
  }),
});

const jwtConfig = JwtModule.registerAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (configService: ConfigService): JwtModuleOptions => ({
    secret: configService.getOrThrow<string>('JWT_SECRET'),
    signOptions: {
      // @ts-expect-error - JWT accepts string format like '15m', TypeScript types are too strict
      expiresIn: configService.get<string>('JWT_ACCESS_EXPIRES', '15m'),
    },
  }),
});

@Module({
  imports: [
    UsersModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    throttlerConfig,
    jwtConfig,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RefreshStrategy],
  exports: [AuthService],
})
export class AuthModule {}