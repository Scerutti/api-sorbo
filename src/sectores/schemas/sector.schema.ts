
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({
  timestamps: true,
  versionKey: false,
  toJSON: { virtuals: true, getters: true },
  toObject: { virtuals: true, getters: true },
})
export class Sector {
  @Prop({ required: true, trim: true, unique: true })
  nombre!: string;

  @Prop()
  descripcion?: string;

  // Baja logica. Un sector inactivo no se puede elegir para vender ni para
  // recibir stock, pero conserva su saldo y su historial de movimientos.
  @Prop({ required: true, default: true })
  activo!: boolean;
}

export type SectorDocument = HydratedDocument<Sector>;

export const SectorSchema = SchemaFactory.createForClass(Sector);

SectorSchema.virtual('id').get(function virtualId(this: SectorDocument) {
  return this._id.toString();
});
