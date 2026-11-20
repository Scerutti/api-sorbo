
import { IsMongoId, IsOptional } from 'class-validator';

export class QueryStockDto {
  @IsOptional()
  @IsMongoId()
  sectorId?: string;

  @IsOptional()
  @IsMongoId()
  productId?: string;
}
