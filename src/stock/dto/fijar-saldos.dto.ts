import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsMongoId,
  Min,
  ValidateNested,
} from 'class-validator';

export class SaldoSectorDto {
  @IsMongoId()
  sectorId!: string;

  /** Saldo final que debe quedar en el sector. */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  cantidad!: number;

  /**
   * Saldo que el usuario tenía en pantalla al editar. Si el de la base ya no
   * es ese (una venta entró mientras el formulario estaba abierto), el
   * backend responde 409 en vez de pisar el cambio.
   */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  esperado!: number;
}

/**
 * Reparto completo de un producto: cuánto queda en cada sector. El backend
 * calcula las transferencias, entradas y ajustes que llevan de los saldos
 * actuales a estos. Un sector que no viene en la lista no se toca.
 */
export class FijarSaldosDto {
  @IsMongoId()
  productId!: string;

  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SaldoSectorDto)
  saldos!: SaldoSectorDto[];
}
