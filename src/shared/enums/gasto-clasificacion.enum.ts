
export enum GastoClasificacion {
  FIJO = 'fijo',
  VARIABLE = 'variable',
}

export const GASTO_CLASIFICACION_VALUES: readonly GastoClasificacion[] =
  Object.freeze([GastoClasificacion.FIJO, GastoClasificacion.VARIABLE]);
