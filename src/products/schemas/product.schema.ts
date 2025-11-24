
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import {
  ProductType,
  PRODUCT_TYPE_VALUES,
} from '../../shared/enums/product-type.enum';

@Schema({
  timestamps: true,
  versionKey: false,
  toJSON: { virtuals: true, getters: true },
  toObject: { virtuals: true, getters: true },
})
export class Product {
  @Prop({ required: true, trim: true })
  nombre!: string;

  @Prop({ required: true, type: String, enum: PRODUCT_TYPE_VALUES })
  tipo!: ProductType;

  @Prop({ required: true, min: 0 })
  precioCosto!: number;

  @Prop({ required: true, min: 0 })
  porcentajeGanancia!: number;

  @Prop({ required: true, min: 0, default: 0 })
  porcentajeGananciaMayorista!: number;

  // costos y precioVenta se calculan en el frontend, NO se guardan en DB

  @Prop({ required: true, min: 0, default: 0 })
  stock!: number;

  @Prop({ required: true, min: 0, default: 0 })
  soldCount!: number;
}

export type ProductDocument = HydratedDocument<Product>;

export const ProductSchema = SchemaFactory.createForClass(Product);

ProductSchema.virtual('id').get(function virtualId(this: ProductDocument) {
  return this._id.toString();
});
