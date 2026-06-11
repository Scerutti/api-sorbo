
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateInversionDto {
  @IsString()
  @MinLength(2)
  descripcion!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  monto!: number;

  @IsOptional()
  @IsDateString()
  fecha?: string;
}
