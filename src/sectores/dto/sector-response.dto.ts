
import { Expose } from 'class-transformer';
import { BaseResponseDto } from '../../shared/types/common.types';

export class SectorResponseDto implements BaseResponseDto {
  @Expose()
  id!: string;

  @Expose()
  nombre!: string;

  @Expose()
  descripcion?: string;

  @Expose()
  esGeneral!: boolean;

  @Expose()
  activo!: boolean;

  @Expose()
  createdAt?: Date;

  @Expose()
  updatedAt?: Date;
}
