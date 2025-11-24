
import { Expose, Transform, Type } from 'class-transformer';
import { ProductType } from '../../shared/enums/product-type.enum';
import { BaseResponseDto } from '../../shared/types/common.types';

export class ProductResponseDto implements BaseResponseDto {
  @Expose()
  id!: string;

  @Expose()
  nombre!: string;

  @Expose()
  tipo!: ProductType;

  @Expose()
  @Type(() => Number)
  precioCosto!: number;

  @Expose()
  @Type(() => Number)
  porcentajeGanancia!: number;

  @Expose()
  @Type(() => Number)
  porcentajeGananciaMayorista!: number;

  // costos y precioVenta se calculan en el frontend, pero se incluyen en la respuesta para compatibilidad
  // Estos campos NO existen en la DB, se calculan basándose en CostItems y porcentajeGanancia
  @Expose()
  @Transform(() => []) // Retorna array vacío, el frontend calculará los costos aplicables
  costos!: string[];

  @Expose()
  @Transform(({ obj }) => {
    // Calcular precioVenta básico: precioCosto * (1 + porcentajeGanancia / 100)
    // El frontend deberá calcularlo correctamente con los costos aplicables
    const typedObj = obj as {
      precioCosto?: number;
      porcentajeGanancia?: number;
    };
    const precioCosto = typedObj.precioCosto ?? 0;
    const porcentajeGanancia = typedObj.porcentajeGanancia ?? 0;
    return precioCosto * (1 + porcentajeGanancia / 100);
  })
  @Type(() => Number)
  precioVenta!: number;

  @Expose()
  @Transform(({ obj }) => {
    // Calcular precioVentaMayorista: precioCosto * (1 + porcentajeGananciaMayorista / 100)
    const typedObj = obj as {
      precioCosto?: number;
      porcentajeGananciaMayorista?: number;
    };
    const precioCosto = typedObj.precioCosto ?? 0;
    const porcentajeGananciaMayorista = typedObj.porcentajeGananciaMayorista ?? 0;
    return precioCosto * (1 + porcentajeGananciaMayorista / 100);
  })
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
