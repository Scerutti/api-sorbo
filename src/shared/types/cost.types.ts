
import { CostItemType } from '../enums/cost-item-type.enum';

export interface CostItemContract {
  id: string;
  nombre: string;
  tipo: CostItemType;
  valor: number;
  componentes?: string[];
  descripcion?: string;
}
