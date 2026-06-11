
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { GastoClasificacion } from '../../shared/enums/gasto-clasificacion.enum';

export class CreateGastoDto {
  @IsString()
  @MinLength(2)
  nombre!: string;

  @IsEnum(GastoClasificacion)
  clasificacion!: GastoClasificacion;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  montoTotal!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  porPaquetes!: number;

  @IsOptional()
  @IsString()
  descripcion?: string;
}
