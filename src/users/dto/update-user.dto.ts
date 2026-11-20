import { OmitType, PartialType } from '@nestjs/mapped-types';
import { IsMongoId, IsOptional } from 'class-validator';
import { RegisterDto } from '../../auth/dto/register.dto';

export class UpdateUserDto extends PartialType(
  OmitType(RegisterDto, ['sectorId'] as const),
) {
  // null quita el sector asignado; ausente lo deja como esta.
  @IsOptional()
  @IsMongoId()
  sectorId?: string | null;
}
