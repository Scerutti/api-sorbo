
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsMongoId,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { TipoMovimiento } from '../../shared/enums/tipo-movimiento.enum';

export class QueryMovimientosDto {
  @IsOptional()
  @IsMongoId()
  productId?: string;

  // Trae los movimientos que entraron o salieron de este sector.
  @IsOptional()
  @IsMongoId()
  sectorId?: string;

  @IsOptional()
  @IsEnum(TipoMovimiento)
  tipo?: TipoMovimiento;

  @IsOptional()
  @IsISO8601()
  fechaDesde?: string;

  @IsOptional()
  @IsISO8601()
  fechaHasta?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
