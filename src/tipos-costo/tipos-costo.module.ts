
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TipoCosto, TipoCostoSchema } from './schemas/tipo-costo.schema';
import { TiposCostoController } from './tipos-costo.controller';
import { TiposCostoService } from './tipos-costo.service';
import { CostItem, CostItemSchema } from '../costs/schemas/cost-item.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';

@Module({
  imports: [
    // CostItem y Product se re-registran por schema (no por modulo) para poder
    // contar referencias al borrar un tipo sin crear una dependencia circular.
    MongooseModule.forFeature([
      { name: TipoCosto.name, schema: TipoCostoSchema },
      { name: CostItem.name, schema: CostItemSchema },
      { name: Product.name, schema: ProductSchema },
    ]),
  ],
  controllers: [TiposCostoController],
  providers: [TiposCostoService],
  exports: [TiposCostoService],
})
export class TiposCostoModule {}
