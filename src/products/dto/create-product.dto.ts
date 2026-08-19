
import { Type } from 'class-transformer';
import {
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  nombre!: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  // Tipo de costo asignado: determina que CostItem se le suman al producto.
  @IsMongoId()
  tipoId!: string;

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

  // costos y precioVenta se calculan en ProductsService, NO se envían.

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
