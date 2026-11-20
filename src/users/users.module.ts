
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Sector, SectorSchema } from '../sectores/schemas/sector.schema';
import { User, UserSchema } from './schemas/user.schema';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    // Sector se re-registra por schema para validar que el sector asignado a
    // un usuario exista, sin depender de SectoresModule.
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Sector.name, schema: SectorSchema },
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService, MongooseModule],
})
export class UsersModule {}
