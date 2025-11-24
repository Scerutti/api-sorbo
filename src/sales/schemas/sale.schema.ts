
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Product } from '../../products/schemas/product.schema';
import { User } from '../../users/schemas/user.schema';

@Schema({ _id: false, versionKey: false })
export class SaleItemSnapshot {
  @Prop({ required: true, min: 0 })
  precioCosto!: number;

  @Prop({ required: true, min: 0 })
  costos!: number;

  @Prop({ required: true, min: 0 })
  porcentajeGanancia!: number;

  @Prop({ required: false, min: 0 })
  porcentajeGananciaMayorista?: number;

  @Prop({ required: true, min: 0 })
  precioVenta!: number;
}

export const SaleItemSnapshotSchema =
  SchemaFactory.createForClass(SaleItemSnapshot);

@Schema({ _id: false, versionKey: false })
export class SaleItem {
  @Prop({ type: Types.ObjectId, ref: Product.name, required: true })
  productId!: Types.ObjectId;

  @Prop({ required: true })
  productNombre!: string;

  @Prop({ required: true, min: 1 })
  cantidad!: number;

  @Prop({ required: true, min: 0 })
  precioUnitario!: number;

  @Prop({ type: SaleItemSnapshotSchema, required: true })
  snapshot!: SaleItemSnapshot;
}

export const SaleItemSchema = SchemaFactory.createForClass(SaleItem);

@Schema({
  timestamps: true,
  versionKey: false,
  toJSON: { virtuals: true, getters: true },
  toObject: { virtuals: true, getters: true },
})
export class Sale {
  @Prop({ required: true, default: Date.now })
  fecha!: Date;

  @Prop({ type: [SaleItemSchema], required: true, default: [] })
  items!: SaleItem[];

  @Prop({ required: true, min: 0 })
  total!: number;

  @Prop({ required: true, default: false })
  esMayorista!: boolean;

  @Prop({ type: Types.ObjectId, ref: User.name, required: false })
  vendedorId?: Types.ObjectId;
}

export type SaleDocument = HydratedDocument<Sale>;

export const SaleSchema = SchemaFactory.createForClass(Sale);

SaleSchema.virtual('id').get(function virtualId(this: SaleDocument) {
  return this._id.toString();
});
