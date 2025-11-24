
import { ProductType } from '../enums/product-type.enum';
import { MongoId } from './common.types';

export interface ProductContract {
  id: MongoId;
  nombre: string;
  tipo: ProductType;
  precioCosto: number;
  porcentajeGanancia: number;
  porcentajeGananciaMayorista: number;
  costos: MongoId[];
  precioVenta: number;
  precioVentaMayorista: number;
  stock: number;
  soldCount: number;
}
