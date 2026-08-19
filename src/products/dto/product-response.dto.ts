
import { Expose, Type } from 'class-transformer';
import { BaseResponseDto } from '../../shared/types/common.types';

export class ProductResponseDto implements BaseResponseDto {
  @Expose()
  id!: string;

  @Expose()
  nombre!: string;

  @Expose()
  descripcion?: string;

  @Expose()
  tipoId!: string;

  // Nombre del tipo resuelto, para que el front no cruce colecciones.
  @Expose()
  tipoNombre!: string;

  @Expose()
  @Type(() => Number)
  precioCosto!: number;

  @Expose()
  @Type(() => Number)
  porcentajeGanancia!: number;

  @Expose()
  @Type(() => Number)
  porcentajeGananciaMayorista!: number;

  // Suma de los CostItem aplicables (globales + los del tipo del producto).
  // Se calcula en ProductsService; no existe en la DB.
  @Expose()
  @Type(() => Number)
  costos!: number;

  @Expose()
  @Type(() => Number)
  precioVenta!: number;

  @Expose()
  @Type(() => Number)
  precioVentaMayorista!: number;

  @Expose()
  @Type(() => Number)
  stock!: number;

  @Expose()
  @Type(() => Number)
  soldCount!: number;

  @Expose()
  @Type(() => Date)
  createdAt?: Date;

  @Expose()
  @Type(() => Date)
  updatedAt?: Date;
}
