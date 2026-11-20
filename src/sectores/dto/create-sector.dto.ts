
import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateSectorDto {
  @IsString()
  @MinLength(2)
  nombre!: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  // Marca el deposito central donde entra la compra de insumos. Solo uno.
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  esGeneral?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  activo?: boolean;
}
