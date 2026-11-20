
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Sector, SectorSchema } from './schemas/sector.schema';
import { SectoresController } from './sectores.controller';
import { SectoresService } from './sectores.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Sector.name, schema: SectorSchema }]),
  ],
  controllers: [SectoresController],
  providers: [SectoresService],
  exports: [SectoresService],
})
export class SectoresModule {}
