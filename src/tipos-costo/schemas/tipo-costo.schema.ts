
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({
  timestamps: true,
  versionKey: false,
  toJSON: { virtuals: true, getters: true },
  toObject: { virtuals: true, getters: true },
})
export class TipoCosto {
  @Prop({ required: true, trim: true, unique: true })
  nombre!: string;

  @Prop()
  descripcion?: string;

  // Si es true, los costos de este tipo se suman a TODOS los productos
  // (comportamiento historico de "general" y "amortizable").
  // Si es false, es un tipo asignable: solo aplica a los productos que lo
  // seleccionaron explicitamente.
  @Prop({ required: true, default: false })
  aplicaATodos!: boolean;
}

export type TipoCostoDocument = HydratedDocument<TipoCosto>;

export const TipoCostoSchema = SchemaFactory.createForClass(TipoCosto);

TipoCostoSchema.virtual('id').get(function virtualId(this: TipoCostoDocument) {
  return this._id.toString();
});
