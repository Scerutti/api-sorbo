
export enum TipoMovimiento {
  // Compra de insumos: entra stock al depósito general.
  ENTRADA = 'entrada',
  // Sale stock de un sector (venta, rotura, consumo).
  SALIDA = 'salida',
  // Reparto entre sectores: sale de uno y entra en otro.
  TRANSFERENCIA = 'transferencia',
  // Corrección por conteo físico. Lleva el saldo a un valor absoluto.
  AJUSTE = 'ajuste',
}

export const TIPO_MOVIMIENTO_VALUES: readonly TipoMovimiento[] = Object.freeze([
  TipoMovimiento.ENTRADA,
  TipoMovimiento.SALIDA,
  TipoMovimiento.TRANSFERENCIA,
  TipoMovimiento.AJUSTE,
]);
