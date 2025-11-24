
import { Expose, Transform, Type } from 'class-transformer';
import { IsOptional } from 'class-validator';

export class SaleItemSnapshotDto {
  @Expose()
  @Type(() => Number)
  precioCosto!: number;

  @Expose()
  @Type(() => Number)
  costos!: number;

  @Expose()
  @Type(() => Number)
  porcentajeGanancia!: number;

  @Expose()
  @IsOptional()
  @Type(() => Number)
  porcentajeGananciaMayorista?: number;

  @Expose()
  @Type(() => Number)
  precioVenta!: number;
}

export class SaleItemDto {
  @Expose()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value;
    }

    if (value !== null && typeof value === 'object') {
      const candidate = value as { toString?: () => string };
      if (typeof candidate.toString === 'function') {
        return candidate.toString();
      }
    }

    return String(value ?? '');
  })
  productId!: string;

  @Expose()
  productNombre!: string;

  @Expose()
  @Type(() => Number)
  cantidad!: number;

  @Expose()
  @Type(() => Number)
  precioUnitario!: number;

  @Expose()
  @Type(() => SaleItemSnapshotDto)
  snapshot!: SaleItemSnapshotDto;
}
