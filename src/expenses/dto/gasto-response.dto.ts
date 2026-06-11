
import { Expose, Type } from 'class-transformer';
import { GastoClasificacion } from '../../shared/enums/gasto-clasificacion.enum';
import { BaseResponseDto } from '../../shared/types/common.types';

export class GastoResponseDto implements BaseResponseDto {
  @Expose()
  id!: string;

  @Expose()
  nombre!: string;

  @Expose()
  clasificacion!: GastoClasificacion;

  @Expose()
  @Type(() => Number)
  montoTotal!: number;

  @Expose()
  @Type(() => Number)
  porPaquetes!: number;

  @Expose()
  @Type(() => Number)
  valorUnitario!: number;

  @Expose()
  descripcion?: string;

  @Expose()
  @Type(() => Date)
  createdAt?: Date;

  @Expose()
  @Type(() => Date)
  updatedAt?: Date;
}
