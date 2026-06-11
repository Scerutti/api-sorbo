
import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { plainToInstance } from 'class-transformer';
import { Model } from 'mongoose';
import { CreateGastoDto } from './dto/create-gasto.dto';
import { GastoResponseDto } from './dto/gasto-response.dto';
import { UpdateGastoDto } from './dto/update-gasto.dto';
import { GastoBase, GastoBaseDocument } from './schemas/gasto-base.schema';
import { GastoClasificacion } from '../shared/enums/gasto-clasificacion.enum';

@Injectable()
export class GastosService {
  constructor(
    @InjectModel(GastoBase.name)
    private readonly gastoModel: Model<GastoBaseDocument>,
  ) {}

  async create(createGastoDto: CreateGastoDto): Promise<GastoResponseDto> {
    try {
      const createdGasto = await this.gastoModel.create(createGastoDto);
      return this.mapToDto(createdGasto);
    } catch (error) {
      throw new HttpException(
        this.extractMessage(error, 'No se pudo crear el gasto'),
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async findAll(): Promise<GastoResponseDto[]> {
    const gastos = await this.gastoModel.find().exec();
    return gastos.map((gasto) => this.mapToDto(gasto));
  }

  async findOne(id: string): Promise<GastoResponseDto> {
    const gasto = await this.gastoModel.findById(id).exec();
    if (!gasto) {
      throw new NotFoundException('Gasto no encontrado');
    }

    return this.mapToDto(gasto);
  }

  async update(
    id: string,
    updateGastoDto: UpdateGastoDto,
  ): Promise<GastoResponseDto> {
    try {
      const updatedGasto = await this.gastoModel
        .findByIdAndUpdate(id, updateGastoDto, {
          new: true,
          runValidators: true,
        })
        .exec();

      if (!updatedGasto) {
        throw new NotFoundException('Gasto no encontrado');
      }

      return this.mapToDto(updatedGasto);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        this.extractMessage(error, 'No se pudo actualizar el gasto'),
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async remove(id: string): Promise<void> {
    const deletedGasto = await this.gastoModel.findByIdAndDelete(id).exec();
    if (!deletedGasto) {
      throw new NotFoundException('Gasto no encontrado');
    }
  }

  /**
   * Devuelve la suma de valorUnitario de los gastos base indicados.
   * Usado por CostsService para componer el valor de un costo.
   */
  async sumValorUnitario(ids: string[]): Promise<number> {
    if (!ids?.length) {
      return 0;
    }

    const gastos = await this.gastoModel.find({ _id: { $in: ids } }).exec();
    return gastos.reduce((acc, gasto) => {
      const valorUnitario = gasto.porPaquetes
        ? gasto.montoTotal / gasto.porPaquetes
        : 0;
      return acc + valorUnitario;
    }, 0);
  }

  /**
   * Suma el montoTotal de los gastos según su clasificación (fijo / variable).
   * Usado por los reportes de punto de equilibrio y ganancias.
   */
  async sumMontoTotalByClasificacion(
    clasificacion: GastoClasificacion,
  ): Promise<number> {
    const gastos = await this.gastoModel.find({ clasificacion }).exec();
    return gastos.reduce((acc, gasto) => acc + gasto.montoTotal, 0);
  }

  private mapToDto(gasto: GastoBaseDocument): GastoResponseDto {
    const plainGasto = gasto.toObject();

    return plainToInstance(GastoResponseDto, plainGasto, {
      excludeExtraneousValues: true,
    });
  }

  private extractMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    return fallback;
  }
}
