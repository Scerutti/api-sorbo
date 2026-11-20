
import { IsMongoId, IsOptional } from 'class-validator';

export class QueryResumenDto {
  // Acota el consolidado a un solo producto. Sin esto, trae todos.
  @IsOptional()
  @IsMongoId()
  productId?: string;
}
