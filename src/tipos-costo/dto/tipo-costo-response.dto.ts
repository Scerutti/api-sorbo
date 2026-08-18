
import { Expose } from 'class-transformer';
import { BaseResponseDto } from '../../shared/types/common.types';

export class TipoCostoResponseDto implements BaseResponseDto {
  @Expose()
  id!: string;

  @Expose()
  nombre!: string;

  @Expose()
  descripcion?: string;

  @Expose()
  aplicaATodos!: boolean;

  @Expose()
  createdAt?: Date;

  @Expose()
  updatedAt?: Date;
}
