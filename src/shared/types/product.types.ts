
import { MongoId } from './common.types';

export interface ProductContract {
  id: MongoId;
  nombre: string;
  descripcion?: string | undefined;
  tipoId: MongoId;
  tipoNombre: string;
  precioCosto: number;
  porcentajeGanancia: number;
  porcentajeGananciaMayorista: number;
  // Suma de los CostItem aplicables al producto (calculada, no persistida).
  costos: number;
  precioVenta: number;
  precioVentaMayorista: number;
  stock: number;
  soldCount: number;
  createdAt?: Date | undefined;
  updatedAt?: Date | undefined;
}
