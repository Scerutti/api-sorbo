
import { Type } from 'class-transformer';
import {
  Allow,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsISO8601,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateSaleItemSnapshotDto {
  @Allow()
  @IsOptional()
  @IsNumber()
  precioCosto?: number;

  @Allow()
  @IsOptional()
  @IsNumber()
  costos?: number;

  @Allow()
  @IsOptional()
  @IsNumber()
  porcentajeGanancia?: number;

  @Allow()
  @IsOptional()
  @IsNumber()
  porcentajeGananciaMayorista?: number;

  @Allow()
  @IsOptional()
  @IsNumber()
  precioVenta?: number;
}

export class CreateSaleDto {
  @IsOptional()
  @IsISO8601()
  fecha?: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items!: CreateSaleItemDto[];

  // El frontend puede enviar total, pero el backend lo recalcula
  @Allow()
  @IsOptional()
  @IsNumber()
  total?: number;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  esMayorista?: boolean;

  // El frontend puede enviar vendedorId, pero el backend lo obtiene del usuario autenticado
  @Allow()
  @IsOptional()
  @IsMongoId()
  vendedorId?: string;
}

export class CreateSaleItemDto {
  @IsMongoId()
  productId!: string;

  // El frontend puede enviar productNombre, pero el backend lo obtiene de la DB
  @Allow()
  @IsOptional()
  @IsString()
  productNombre?: string;

  @Type(() => Number)
  @Min(1)
  cantidad!: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  precioUnitario?: number;

  // El frontend puede enviar snapshot, pero el backend lo recalcula desde la DB
  @Allow()
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateSaleItemSnapshotDto)
  snapshot?: CreateSaleItemSnapshotDto;
}
