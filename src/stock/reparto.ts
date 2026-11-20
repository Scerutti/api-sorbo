import { TipoMovimiento } from '../shared/enums/tipo-movimiento.enum';

/** Un sector cuyo saldo pasa de `actual` a `nuevo`. */
export interface CambioSaldo {
  sectorId: string;
  actual: number;
  nuevo: number;
}

/** Una fila del libro que explica parte del cambio. */
export interface PasoReparto {
  tipo: TipoMovimiento;
  sectorOrigenId?: string;
  sectorDestinoId?: string;
  cantidad: number;
  motivo: string;
}

/**
 * Traduce "cuánto queda en cada sector" a movimientos del libro.
 *
 * Primero se emparejan los sectores que bajan con los que suben: esas
 * unidades no aparecen ni desaparecen, cambian de lugar, así que van como
 * transferencias y el libro muestra de dónde a dónde. Lo que sobra después
 * es stock que entra (entrada) o que se corrige a la baja (ajuste).
 *
 * Es la misma regla que antes aplicaba el formulario del producto, movida al
 * backend para que el guardado sea un solo request.
 */
export function planificarReparto(cambios: CambioSaldo[]): PasoReparto[] {
  const reales = cambios.filter((c) => c.nuevo !== c.actual);

  const bajan = reales
    .filter((c) => c.nuevo < c.actual)
    .map((c) => ({ ...c, resto: c.actual - c.nuevo }));
  const suben = reales
    .filter((c) => c.nuevo > c.actual)
    .map((c) => ({ ...c, resto: c.nuevo - c.actual }));

  const pasos: PasoReparto[] = [];

  for (const destino of suben) {
    for (const origen of bajan) {
      if (destino.resto === 0) break;
      const cantidad = Math.min(destino.resto, origen.resto);
      if (cantidad === 0) continue;
      pasos.push({
        tipo: TipoMovimiento.TRANSFERENCIA,
        sectorOrigenId: origen.sectorId,
        sectorDestinoId: destino.sectorId,
        cantidad,
        motivo: 'Reparto desde el producto',
      });
      destino.resto -= cantidad;
      origen.resto -= cantidad;
    }
  }

  for (const destino of suben) {
    if (destino.resto > 0) {
      pasos.push({
        tipo: TipoMovimiento.ENTRADA,
        sectorDestinoId: destino.sectorId,
        cantidad: destino.resto,
        motivo: 'Carga desde el producto',
      });
    }
  }

  // Un ajuste a la baja se asienta con origen, igual que en aplicarAjuste.
  for (const origen of bajan) {
    if (origen.resto > 0) {
      pasos.push({
        tipo: TipoMovimiento.AJUSTE,
        sectorOrigenId: origen.sectorId,
        cantidad: origen.resto,
        motivo: 'Ajuste desde el producto',
      });
    }
  }

  return pasos;
}
