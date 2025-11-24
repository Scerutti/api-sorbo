
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
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

  @Prop({ type: [RefreshTokenSnapshotSchema], default: [] })
  refreshTokens!: RefreshTokenSnapshot[];
}

export type UserDocument = HydratedDocument<User>;

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.virtual('id').get(function virtualId(this: UserDocument) {
  return this._id.toString();
});
