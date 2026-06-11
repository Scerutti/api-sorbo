
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({
  timestamps: true,
  versionKey: false,
  toJSON: { virtuals: true, getters: true },
  toObject: { virtuals: true, getters: true },
})
export class Inversion {
  @Prop({ required: true, trim: true })
  descripcion!: string;

  @Prop({ required: true, min: 0 })
  monto!: number;

  @Prop({ required: true, default: Date.now })
  fecha!: Date;
}

export type InversionDocument = HydratedDocument<Inversion>;

export const InversionSchema = SchemaFactory.createForClass(Inversion);

InversionSchema.virtual('id').get(function virtualId(this: InversionDocument) {
  return this._id.toString();
});
