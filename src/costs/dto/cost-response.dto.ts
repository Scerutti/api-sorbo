
import { Expose, Transform, Type } from 'class-transformer';
import { BaseResponseDto } from '../../shared/types/common.types';

export class CostResponseDto implements BaseResponseDto {
  @Expose()
  id!: string;

  @Expose()
  nombre!: string;

  @Expose()
  tipoId!: string;

  // Nombre del tipo resuelto, para que el front no tenga que cruzar colecciones.
  @Expose()
  tipoNombre!: string;

  @Expose()
  @Type(() => Number)
  valor!: number;

  @Expose()
  @Transform(({ value }) =>
    Array.isArray(value) ? value.map((id: unknown) => String(id)) : [],
  )
  componentes!: string[];

  @Expose()
  descripcion?: string;

  @Expose()
  createdAt?: Date;

  @Expose()
  updatedAt?: Date;
}
