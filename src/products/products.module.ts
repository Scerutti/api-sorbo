
import { Module } from '@nestjs/common';
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
    CostsModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
