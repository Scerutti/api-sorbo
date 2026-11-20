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
