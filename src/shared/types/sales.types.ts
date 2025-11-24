
import { MongoId } from './common.types';

export interface SaleItemSnapshot {
  precioCosto: number;
  costos: number;
  porcentajeGanancia: number;
  porcentajeGananciaMayorista?: number;
  precioVenta: number;
}

export interface SaleItemSnapshotInput extends SaleItemSnapshot {
  productId: MongoId;
}

export interface SaleItemView {
  productId: MongoId;
  productNombre: string;
  cantidad: number;
  precioUnitario: number;
  snapshot: SaleItemSnapshot;
}

export interface SaleContract {
  id: MongoId;
  fecha: Date;
  items: SaleItemView[];
  total: number;
  esMayorista: boolean;
  vendedorId?: MongoId;
}
