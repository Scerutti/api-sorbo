
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import {
  GastoClasificacion,
  GASTO_CLASIFICACION_VALUES,
} from '../../shared/enums/gasto-clasificacion.enum';

@Schema({
  timestamps: true,
  versionKey: false,
  toJSON: { virtuals: true, getters: true },
  toObject: { virtuals: true, getters: true },
})
export class GastoBase {
  @Prop({ required: true, trim: true })
  nombre!: string;

  @Prop({ required: true, type: String, enum: GASTO_CLASIFICACION_VALUES })
  clasificacion!: GastoClasificacion;

  @Prop({ required: true, min: 0 })
  montoTotal!: number;

  @Prop({ required: true, min: 1 })
  porPaquetes!: number;

  @Prop()
  descripcion?: string;
}

export type GastoBaseDocument = HydratedDocument<GastoBase>;

export const GastoBaseSchema = SchemaFactory.createForClass(GastoBase);

GastoBaseSchema.virtual('id').get(function virtualId(this: GastoBaseDocument) {
  return this._id.toString();
});

GastoBaseSchema.virtual('valorUnitario').get(function virtualValorUnitario(
  this: GastoBaseDocument,
) {
  if (!this.porPaquetes) {
    return 0;
  }
  return this.montoTotal / this.porPaquetes;
});
