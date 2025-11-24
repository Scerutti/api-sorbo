
import { PartialType } from '@nestjs/mapped-types';
import { CreateCostDto } from './create-cost.dto';

export class UpdateCostDto extends PartialType(CreateCostDto) {}
