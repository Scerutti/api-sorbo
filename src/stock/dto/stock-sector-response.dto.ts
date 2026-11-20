
import { Expose, Type } from 'class-transformer';
import { BaseResponseDto } from '../../shared/types/common.types';

export class StockSectorResponseDto implements BaseResponseDto {
  @Expose()
  id!: string;

  @Expose()
  productId!: string;

  // Nombre resuelto por el servicio, para que el front no cruce colecciones.
  @Expose()
  productNombre!: string;

  @Expose()
  sectorId!: string;

  @Expose()
  sectorNombre!: string;

  @Expose()
  @Type(() => Number)
  cantidad!: number;

  @Expose()
  @Type(() => Date)
  createdAt?: Date;

  @Expose()
  @Type(() => Date)
  updatedAt?: Date;
}
