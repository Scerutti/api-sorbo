
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { TipoMovimiento } from '../../shared/enums/tipo-movimiento.enum';

export class CreateMovimientoDto {
  @IsEnum(TipoMovimiento)
  tipo!: TipoMovimiento;

  @IsMongoId()
  productId!: string;

  // De donde sale el stock. Requerido en salida y transferencia.
  @IsOptional()
  @IsMongoId()
  sectorOrigenId?: string;

  // A donde entra el stock. Requerido en entrada, transferencia y ajuste.
  @IsOptional()
  @IsMongoId()
  sectorDestinoId?: string;

  /**
   * En entrada, salida y transferencia: cuantas unidades se mueven (>= 1).
   * En ajuste: el saldo final que debe quedar en el sector (>= 0); el servicio
   * calcula el delta contra el saldo actual y registra ese delta.
   */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  cantidad!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  motivo?: string;
}
