
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { TipoCosto } from '../../tipos-costo/schemas/tipo-costo.schema';

@Schema({
  timestamps: true,
  versionKey: false,
  toJSON: { virtuals: true, getters: true },
  toObject: { virtuals: true, getters: true },
})
export class Product {
  @Prop({ required: true, trim: true })
  nombre!: string;

  @Prop({ type: String, trim: true, required: false })
  descripcion?: string;

  // Tipo de costo asignado al producto: determina que CostItem se le suman.
  @Prop({
    type: Types.ObjectId,
    ref: TipoCosto.name,
    required: true,
    index: true,
  })
  tipoId!: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  precioCosto!: number;

  @Prop({ required: true, min: 0 })
  porcentajeGanancia!: number;

  @Prop({ required: true, min: 0, default: 0 })
  porcentajeGananciaMayorista!: number;

  // costos y precioVenta se calculan en ProductsService a partir de los
  // CostItem aplicables, NO se guardan en DB.

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
