
import { Expose, Transform, Type } from 'class-transformer';
import { BaseResponseDto } from '../../shared/types/common.types';
import { SaleItemDto } from './sale-item.dto';

export class SaleResponseDto implements BaseResponseDto {
  @Expose()
  id!: string;

  @Expose()
  @Type(() => Date)
  fecha!: Date;

  @Expose({ name: 'items' })
  @Type(() => SaleItemDto)
  items!: SaleItemDto[];

  @Expose()
  @Type(() => Number)
  total!: number;

  @Expose()
  @Type(() => Boolean)
  esMayorista!: boolean;

  @Expose()
  @Transform(({ value }) => {
    if (!value) return undefined;
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object') {
      const obj = value as { toString?: () => string };
      if (typeof obj.toString === 'function') {
        return obj.toString();
      }
    }
    return String(value ?? '');
  })
  vendedorId?: string;

  @Expose()
  @Type(() => Date)
  createdAt?: Date;

  @Expose()
  @Type(() => Date)
  updatedAt?: Date;
}
