
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ProductType } from '../../shared/enums/product-type.enum';

export class CreateProductDto {
  @IsString()
  nombre!: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsEnum(ProductType)
  tipo!: ProductType;

  @Type(() => Number)
  @Min(0)
  precioCosto!: number;

  @Type(() => Number)
  @Min(0)
  @Max(1000)
  porcentajeGanancia!: number;

  @Type(() => Number)
  @Min(0)
  @Max(1000)
  porcentajeGananciaMayorista!: number;

  // costos y precioVenta se calculan en el frontend, NO se envían al backend

  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  soldCount?: number;
}
