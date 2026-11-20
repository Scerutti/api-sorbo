
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  StockSector,
  StockSectorSchema,
} from '../stock/schemas/stock-sector.schema';
import { Sector, SectorSchema } from './schemas/sector.schema';
import { SectoresController } from './sectores.controller';
import { SectoresService } from './sectores.service';

@Module({
  imports: [
    // StockSector se re-registra por schema (no por modulo) para poder contar
    // saldos al borrar un sector sin crear una dependencia circular.
    MongooseModule.forFeature([
      { name: Sector.name, schema: SectorSchema },
      { name: StockSector.name, schema: StockSectorSchema },
    ]),
  ],
  controllers: [SectoresController],
  providers: [SectoresService],
  exports: [SectoresService],
})
export class SectoresModule {}
