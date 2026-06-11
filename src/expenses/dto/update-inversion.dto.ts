
import { PartialType } from '@nestjs/mapped-types';
import { CreateInversionDto } from './create-inversion.dto';

export class UpdateInversionDto extends PartialType(CreateInversionDto) {}
