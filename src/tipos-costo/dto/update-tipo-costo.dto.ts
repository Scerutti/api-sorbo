
import { PartialType } from '@nestjs/mapped-types';
import { CreateTipoCostoDto } from './create-tipo-costo.dto';

export class UpdateTipoCostoDto extends PartialType(CreateTipoCostoDto) {}
