
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CostsModule } from './costs/costs.module';
import { ProductsModule } from './products/products.module';
import { SalesModule } from './sales/sales.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local', '.env.development'],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const dbName = configService.get<string>('MONGO_DB');

        return {
          uri: configService.getOrThrow<string>('MONGO_URI'),
          ...(dbName ? { dbName } : {}),
          autoIndex: configService.get<string>('NODE_ENV') !== 'production',
        };
      },
    }),
    AuthModule,
    ProductsModule,
    CostsModule,
    SalesModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
