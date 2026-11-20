
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { Sector, SectorSchema } from '../sectores/schemas/sector.schema';
import {
  MovimientoStock,
  MovimientoStockSchema,
} from './schemas/movimiento-stock.schema';
import {
  StockSector,
  StockSectorSchema,
} from './schemas/stock-sector.schema';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';

@Module({
  imports: [
    // Product y Sector se re-registran por schema (no por modulo) para leer
    // nombres y validar sectores sin crear dependencias circulares, igual que
    // hace TiposCostoModule con CostItem y Product.
    MongooseModule.forFeature([
      { name: StockSector.name, schema: StockSectorSchema },
      { name: MovimientoStock.name, schema: MovimientoStockSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Sector.name, schema: SectorSchema },
    ]),
  ],
  controllers: [StockController],
  providers: [StockService],
  exports: [StockService],
})
export class StockModule {}
