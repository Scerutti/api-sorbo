
import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Product, ProductSchema } from './schemas/product.schema';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { CostsModule } from '../costs/costs.module';
import {
  TipoCosto,
  TipoCostoSchema,
} from '../tipos-costo/schemas/tipo-costo.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: TipoCosto.name, schema: TipoCostoSchema },
    ]),
    // forwardRef en ambos extremos: el ciclo
    // Products -> Costs -> Expenses -> Products es tambien un ciclo de require,
    // no solo de inyeccion, asi que la referencia debe evaluarse perezosamente.
    forwardRef(() => CostsModule),
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
