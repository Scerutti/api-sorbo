
import { MongoId } from './common.types';

export interface SectorContract {
  id: MongoId;
  nombre: string;
  descripcion?: string | undefined;
  activo: boolean;
  createdAt?: Date | undefined;
  updatedAt?: Date | undefined;
}
