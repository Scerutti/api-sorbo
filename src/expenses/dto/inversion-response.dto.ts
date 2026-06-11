
import { Expose, Type } from 'class-transformer';
import { BaseResponseDto } from '../../shared/types/common.types';

export class InversionResponseDto implements BaseResponseDto {
  @Expose()
  id!: string;

  @Expose()
  descripcion!: string;

  @Expose()
  @Type(() => Number)
  monto!: number;

  @Expose()
  @Type(() => Date)
  fecha!: Date;

  @Expose()
  @Type(() => Date)
  createdAt?: Date;

  @Expose()
  @Type(() => Date)
  updatedAt?: Date;
}
