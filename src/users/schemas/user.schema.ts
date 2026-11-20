
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Sector } from '../../sectores/schemas/sector.schema';
import { UserRole, USER_ROLE_VALUES } from '../../shared/enums/user-role.enum';

@Schema({ _id: false, versionKey: false })
export class RefreshTokenSnapshot {
  @Prop({ required: true })
  tokenHash!: string;

  @Prop({ required: true })
  expiresAt!: Date;

  @Prop({ required: true, default: Date.now })
  createdAt!: Date;

  @Prop()
  userAgent?: string;

  @Prop()
  ip?: string;
}

export const RefreshTokenSnapshotSchema =
  SchemaFactory.createForClass(RefreshTokenSnapshot);

@Schema({
  timestamps: true,
  versionKey: false,
  toJSON: {
    virtuals: true,
    getters: true,
  },
  toObject: {
    virtuals: true,
    getters: true,
  },
})
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ required: true })
  passwordHash!: string;

  @Prop({ trim: true })
  name?: string;

  @Prop({ type: [String], enum: USER_ROLE_VALUES, default: [] })
  roles!: UserRole[];

  // Sector en el que opera el usuario: sus ventas descuentan de ese stock.
  // Opcional, porque un admin puede no estar asignado a ninguno. JwtStrategy
  // carga el documento completo en cada request, asi que queda disponible en
  // request.user sin tocar el token ni el circuito de refresh.
  @Prop({
    type: Types.ObjectId,
    ref: Sector.name,
    required: false,
    index: true,
  })
  sectorId?: Types.ObjectId;

  @Prop({ type: [RefreshTokenSnapshotSchema], default: [] })
  refreshTokens!: RefreshTokenSnapshot[];
}

export type UserDocument = HydratedDocument<User>;

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.virtual('id').get(function virtualId(this: UserDocument) {
  return this._id.toString();
});
