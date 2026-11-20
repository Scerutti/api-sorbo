
import { Expose, Type } from 'class-transformer';
import { TipoMovimiento } from '../../shared/enums/tipo-movimiento.enum';

export class MovimientoStockResponseDto {
  @Expose()
  id!: string;

  @Expose()
  tipo!: TipoMovimiento;

  @Expose()
  productId!: string;

  @Expose()
  productNombre!: string;

  @Expose()
  sectorOrigenId?: string;

  @Expose()
  sectorOrigenNombre?: string;

  @Expose()
  sectorDestinoId?: string;

  @Expose()
  sectorDestinoNombre?: string;

  @Expose()
  @Type(() => Number)
  cantidad!: number;

  @Expose()
  motivo?: string;

  @Expose()
  saleId?: string;

  @Expose()
  usuarioId?: string;

  @Expose()
  @Type(() => Date)
  fecha!: Date;
}
