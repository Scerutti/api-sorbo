
import { MongoId } from './common.types';
import { TipoMovimiento } from '../enums/tipo-movimiento.enum';

export interface StockSectorContract {
  id: MongoId;
  productId: MongoId;
  productNombre: string;
  sectorId: MongoId;
  sectorNombre: string;
  cantidad: number;
  createdAt?: Date | undefined;
  updatedAt?: Date | undefined;
}

export interface MovimientoStockContract {
  id: MongoId;
  tipo: TipoMovimiento;
  productId: MongoId;
  productNombre: string;
  sectorOrigenId?: MongoId | undefined;
  sectorOrigenNombre?: string | undefined;
  sectorDestinoId?: MongoId | undefined;
  sectorDestinoNombre?: string | undefined;
  cantidad: number;
  motivo?: string | undefined;
  saleId?: MongoId | undefined;
  usuarioId?: MongoId | undefined;
  fecha: Date;
}

export interface StockResumenSectorContract {
  sectorId: MongoId;
  sectorNombre: string;
  esGeneral: boolean;
  cantidad: number;
}

/**
 * Vista consolidada de un producto: el total del emprendimiento y como se
 * reparte entre los sectores.
 */
export interface StockResumenContract {
  productId: MongoId;
  productNombre: string;
  total: number;
  porSector: StockResumenSectorContract[];
}
