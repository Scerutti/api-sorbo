
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { CostItemType } from '../../shared/enums/cost-item-type.enum';

export class CreateCostDto {
  @IsString()
  @MinLength(2)
  nombre!: string;

  @IsEnum(CostItemType)
  tipo!: CostItemType;

  // Opcional: si se envían `componentes`, el `valor` se calcula en el backend.
  // Si no hay componentes, `valor` es obligatorio (validado en el service).
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  valor?: number;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  componentes?: string[];

  @IsOptional()
  @IsString()
  descripcion?: string;
}
