
import { MongoId } from './common.types';

export interface TipoCostoContract {
  id: MongoId;
  nombre: string;
  descripcion?: string | undefined;
  aplicaATodos: boolean;
  createdAt?: Date | undefined;
  updatedAt?: Date | undefined;
}
