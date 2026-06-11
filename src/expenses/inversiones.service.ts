
import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { plainToInstance } from 'class-transformer';
import { FilterQuery, Model } from 'mongoose';
import { CreateInversionDto } from './dto/create-inversion.dto';
import { InversionResponseDto } from './dto/inversion-response.dto';
import { UpdateInversionDto } from './dto/update-inversion.dto';
import { Inversion, InversionDocument } from './schemas/inversion.schema';

@Injectable()
export class InversionesService {
  constructor(
    @InjectModel(Inversion.name)
    private readonly inversionModel: Model<InversionDocument>,
  ) {}

  async create(
    createInversionDto: CreateInversionDto,
  ): Promise<InversionResponseDto> {
    try {
      const payload = {
        descripcion: createInversionDto.descripcion,
        monto: createInversionDto.monto,
        ...(createInversionDto.fecha
          ? { fecha: new Date(createInversionDto.fecha) }
          : {}),
      };
      const createdInversion = await this.inversionModel.create(payload);
      return this.mapToDto(createdInversion);
    } catch (error) {
      throw new HttpException(
        this.extractMessage(error, 'No se pudo crear la inversión'),
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async findAll(
    fechaDesde?: string,
    fechaHasta?: string,
  ): Promise<InversionResponseDto[]> {
    const filter = this.buildDateFilter(fechaDesde, fechaHasta);
    const inversiones = await this.inversionModel
      .find(filter)
      .sort({ fecha: -1 })
      .exec();
    return inversiones.map((inversion) => this.mapToDto(inversion));
  }

  async findOne(id: string): Promise<InversionResponseDto> {
    const inversion = await this.inversionModel.findById(id).exec();
    if (!inversion) {
      throw new NotFoundException('Inversión no encontrada');
    }

    return this.mapToDto(inversion);
  }

  async update(
    id: string,
    updateInversionDto: UpdateInversionDto,
  ): Promise<InversionResponseDto> {
    try {
      const payload: Partial<Inversion> = {};
      if (typeof updateInversionDto.descripcion === 'string') {
        payload.descripcion = updateInversionDto.descripcion;
      }
      if (typeof updateInversionDto.monto === 'number') {
        payload.monto = updateInversionDto.monto;
      }
      if (typeof updateInversionDto.fecha === 'string') {
        payload.fecha = new Date(updateInversionDto.fecha);
      }

      const updatedInversion = await this.inversionModel
        .findByIdAndUpdate(id, payload, {
          new: true,
          runValidators: true,
        })
        .exec();

      if (!updatedInversion) {
        throw new NotFoundException('Inversión no encontrada');
      }

      return this.mapToDto(updatedInversion);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        this.extractMessage(error, 'No se pudo actualizar la inversión'),
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async remove(id: string): Promise<void> {
    const deletedInversion = await this.inversionModel
      .findByIdAndDelete(id)
      .exec();
    if (!deletedInversion) {
      throw new NotFoundException('Inversión no encontrada');
    }
  }

  /**
   * Suma el monto de las inversiones dentro del rango de fechas indicado.
   * Usado por el reporte de ganancias.
   */
  async sumMontoByDateRange(
    fechaDesde?: string,
    fechaHasta?: string,
  ): Promise<number> {
    const filter = this.buildDateFilter(fechaDesde, fechaHasta);
    const inversiones = await this.inversionModel.find(filter).exec();
    return inversiones.reduce((acc, inversion) => acc + inversion.monto, 0);
  }

  private buildDateFilter(
    fechaDesde?: string,
    fechaHasta?: string,
  ): FilterQuery<InversionDocument> {
    const filter: FilterQuery<InversionDocument> = {};
    if (fechaDesde || fechaHasta) {
      filter.fecha = {};
      if (fechaDesde) {
        filter.fecha.$gte = new Date(fechaDesde);
      }
      if (fechaHasta) {
        filter.fecha.$lte = new Date(fechaHasta);
      }
    }
    return filter;
  }

  private mapToDto(inversion: InversionDocument): InversionResponseDto {
    const plainInversion = inversion.toObject();

    return plainToInstance(InversionResponseDto, plainInversion, {
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
