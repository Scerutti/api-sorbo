
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import {
  CostItemType,
  COST_ITEM_TYPE_VALUES,
} from '../../shared/enums/cost-item-type.enum';

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

  @Prop()
  descripcion?: string;
}

export type CostItemDocument = HydratedDocument<CostItem>;

export const CostItemSchema = SchemaFactory.createForClass(CostItem);

CostItemSchema.virtual('id').get(function virtualId(this: CostItemDocument) {
  return this._id.toString();
});
