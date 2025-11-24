
import { Type } from 'class-transformer';
import {
  IsEnum,
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

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  valor!: number;

  @IsOptional()
  @IsString()
  descripcion?: string;
}
