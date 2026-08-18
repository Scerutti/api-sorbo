
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateTipoCostoDto {
  @IsString()
  @MinLength(2)
  nombre!: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  // Si es true, este tipo se aplica automaticamente a todos los productos.
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  aplicaATodos?: boolean;
}
