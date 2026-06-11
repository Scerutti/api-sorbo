
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  CostItemType,
  COST_ITEM_TYPE_VALUES,
} from '../../shared/enums/cost-item-type.enum';
import { GastoBase } from '../../expenses/schemas/gasto-base.schema';

@Schema({
  timestamps: true,
  versionKey: false,
  toJSON: { virtuals: true, getters: true },
  toObject: { virtuals: true, getters: true },
})
export class CostItem {
  @Prop({ required: true, trim: true })
  nombre!: string;

  @Prop({ required: true, type: String, enum: COST_ITEM_TYPE_VALUES })
  tipo!: CostItemType;

  @Prop({ required: true, min: 0 })
  valor!: number;

  // Gastos base que componen este costo. Si tiene elementos, `valor` se
  // recalcula dinámicamente como la suma de sus valorUnitario. Si está vacío,
  // se usa el `valor` cargado a mano (retrocompatibilidad).
  @Prop({
    type: [{ type: Types.ObjectId, ref: GastoBase.name }],
    default: [],
  })
  componentes!: Types.ObjectId[];

  @Prop()
  descripcion?: string;
}

export type CostItemDocument = HydratedDocument<CostItem>;

export const CostItemSchema = SchemaFactory.createForClass(CostItem);

CostItemSchema.virtual('id').get(function virtualId(this: CostItemDocument) {
  return this._id.toString();
});
