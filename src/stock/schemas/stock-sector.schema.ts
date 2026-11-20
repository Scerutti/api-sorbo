
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Product } from '../../products/schemas/product.schema';
import { Sector } from '../../sectores/schemas/sector.schema';

/**
 * Saldo de un producto en un sector. Es la fuente de verdad del stock:
 * el total del emprendimiento es la suma de estas filas.
 *
 * Una fila por par (producto, sector). El índice único compuesto lo garantiza
 * y permite descontar con un update atómico condicional, sin la ventana de
 * carrera que tiene validar-y-despues-escribir.
 */
@Schema({
  timestamps: true,
  versionKey: false,
  toJSON: { virtuals: true, getters: true },
  toObject: { virtuals: true, getters: true },
})
export class StockSector {
  @Prop({
    type: Types.ObjectId,
    ref: Product.name,
    required: true,
    index: true,
  })
  productId!: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: Sector.name,
    required: true,
    index: true,
  })
  sectorId!: Types.ObjectId;

  @Prop({ required: true, min: 0, default: 0 })
  cantidad!: number;
}

export type StockSectorDocument = HydratedDocument<StockSector>;

export const StockSectorSchema = SchemaFactory.createForClass(StockSector);

StockSectorSchema.index({ productId: 1, sectorId: 1 }, { unique: true });

StockSectorSchema.virtual('id').get(function virtualId(
  this: StockSectorDocument,
) {
  return this._id.toString();
});
