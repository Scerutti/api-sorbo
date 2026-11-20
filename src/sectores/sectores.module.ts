
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  StockSector,
  StockSectorSchema,
} from '../stock/schemas/stock-sector.schema';
import { Sale, SaleSchema } from '../sales/schemas/sale.schema';
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
      // Sale, por schema y por la misma razon: saber si hay ventas que
      // apuntan al sector antes de borrarlo.
      { name: Sale.name, schema: SaleSchema },
    ]),
  ],
  controllers: [SectoresController],
  providers: [SectoresService],
  exports: [SectoresService],
})
export class SectoresModule {}
