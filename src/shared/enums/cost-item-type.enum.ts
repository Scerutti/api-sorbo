
export enum CostItemType {
  GENERAL = 'general',
  BLEND = 'blend',
  CAJA = 'caja',
  GIN = 'gin',
  AMORTIZABLE = 'amortizable',
}

export const COST_ITEM_TYPE_VALUES: readonly CostItemType[] = Object.freeze([
  CostItemType.GENERAL,
  CostItemType.BLEND,
  CostItemType.CAJA,
  CostItemType.GIN,
  CostItemType.AMORTIZABLE,
]);
