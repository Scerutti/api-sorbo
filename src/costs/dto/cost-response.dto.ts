
import { Expose, Type } from 'class-transformer';
import { CostItemType } from '../../shared/enums/cost-item-type.enum';
import { BaseResponseDto } from '../../shared/types/common.types';

export class CostResponseDto implements BaseResponseDto {
  @Expose()
  id!: string;

  @Expose()
  nombre!: string;

  @Expose()
  tipo!: CostItemType;

  @Expose()
  @Type(() => Number)
  valor!: number;

  @Expose()
  descripcion?: string;

  @Expose()
  createdAt?: Date;

  @Expose()
  updatedAt?: Date;
}
