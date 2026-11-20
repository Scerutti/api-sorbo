
import { Expose, Type } from 'class-transformer';

export class StockResumenSectorDto {
  @Expose()
  sectorId!: string;

  @Expose()
  sectorNombre!: string;

  @Expose()
  esGeneral!: boolean;

  @Expose()
  @Type(() => Number)
  cantidad!: number;
}

/**
 * Un producto con su total y el desglose por sector. Es la vista de control
 * del stock general del emprendimiento.
 */
export class StockResumenResponseDto {
  @Expose()
  productId!: string;

  @Expose()
  productNombre!: string;

  @Expose()
  @Type(() => Number)
  total!: number;

  @Expose()
  @Type(() => StockResumenSectorDto)
  porSector!: StockResumenSectorDto[];
}
