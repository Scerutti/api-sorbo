
import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { plainToInstance } from 'class-transformer';
import { FilterQuery, Model, Types } from 'mongoose';
import { CreateSectorDto } from './dto/create-sector.dto';
import { SectorResponseDto } from './dto/sector-response.dto';
import { UpdateSectorDto } from './dto/update-sector.dto';
import { Sector, SectorDocument } from './schemas/sector.schema';
import { SectorContract } from '../shared/types/sector.types';

@Injectable()
export class SectoresService {
  constructor(
    @InjectModel(Sector.name)
    private readonly sectorModel: Model<SectorDocument>,
  ) {}

  async create(createSectorDto: CreateSectorDto): Promise<SectorResponseDto> {
    try {
      await this.assertGeneralUnico(createSectorDto.esGeneral);

      const createdSector = await this.sectorModel.create({
        nombre: createSectorDto.nombre,
        descripcion: createSectorDto.descripcion,
        esGeneral: createSectorDto.esGeneral ?? false,
        activo: createSectorDto.activo ?? true,
      });

      return this.mapToDto(createdSector);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException(
          `Ya existe un sector con el nombre "${createSectorDto.nombre}".`,
        );
      }
      throw new HttpException(
        this.extractMessage(error, 'No se pudo crear el sector'),
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async findAll(): Promise<SectorResponseDto[]> {
    const sectores = await this.sectorModel.find().sort({ nombre: 1 }).exec();
    return sectores.map((sector) => this.mapToDto(sector));
  }

  async findOne(id: string): Promise<SectorResponseDto> {
    const sector = await this.sectorModel.findById(id).exec();
    if (!sector) {
      throw new NotFoundException('Sector no encontrado');
    }
    return this.mapToDto(sector);
  }

  async update(
    id: string,
    updateSectorDto: UpdateSectorDto,
  ): Promise<SectorResponseDto> {
    try {
      const sector = await this.sectorModel.findById(id).exec();
      if (!sector) {
        throw new NotFoundException('Sector no encontrado');
      }

      await this.assertGeneralUnico(updateSectorDto.esGeneral, id);

      // El deposito general es el punto de entrada de la compra de insumos:
      // desactivarlo o degradarlo dejaria al circuito sin donde recibir.
      if (sector.esGeneral && updateSectorDto.activo === false) {
        throw new ConflictException(
          'No se puede desactivar el depósito general.',
        );
      }
      if (sector.esGeneral && updateSectorDto.esGeneral === false) {
        throw new ConflictException(
          'No se puede quitar la marca de depósito general. Asignala a otro sector primero.',
        );
      }

      const payload: Partial<Sector> = {};

      if (typeof updateSectorDto.nombre === 'string') {
        payload.nombre = updateSectorDto.nombre;
      }
      if (typeof updateSectorDto.descripcion !== 'undefined') {
        payload.descripcion = updateSectorDto.descripcion;
      }
      if (typeof updateSectorDto.esGeneral !== 'undefined') {
        payload.esGeneral = updateSectorDto.esGeneral;
      }
      if (typeof updateSectorDto.activo !== 'undefined') {
        payload.activo = updateSectorDto.activo;
      }

      const updatedSector = await this.sectorModel
        .findByIdAndUpdate(id, payload, { new: true, runValidators: true })
        .exec();

      if (!updatedSector) {
        throw new NotFoundException('Sector no encontrado');
      }

      return this.mapToDto(updatedSector);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException(
          `Ya existe un sector con el nombre "${updateSectorDto.nombre ?? ''}".`,
        );
      }
      throw new HttpException(
        this.extractMessage(error, 'No se pudo actualizar el sector'),
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async remove(id: string): Promise<void> {
    const sector = await this.sectorModel.findById(id).exec();
    if (!sector) {
      throw new NotFoundException('Sector no encontrado');
    }

    if (sector.esGeneral) {
      throw new ConflictException(
        'No se puede eliminar el depósito general. Es el punto de entrada de la compra de insumos.',
      );
    }

    await this.sectorModel.findByIdAndDelete(id).exec();
  }

  /**
   * Solo puede haber un sector marcado como deposito general. El indice
   * parcial del schema lo garantiza en la base; esto lo valida antes para
   * devolver un 409 con un mensaje util en lugar de un error de duplicado.
   */
  private async assertGeneralUnico(
    esGeneral: boolean | undefined,
    excluirId?: string,
  ): Promise<void> {
    if (!esGeneral) {
      return;
    }

    const filtro: FilterQuery<SectorDocument> = { esGeneral: true };
    if (excluirId) {
      filtro._id = { $ne: new Types.ObjectId(excluirId) };
    }

    const yaExiste = await this.sectorModel.exists(filtro);
    if (yaExiste) {
      throw new ConflictException(
        'Ya existe un sector marcado como depósito general. Solo puede haber uno.',
      );
    }
  }

  private mapToDto(sector: SectorDocument): SectorResponseDto {
    const plainSector = sector.toObject();

    const source: SectorContract = {
      id: sector.id as string,
      nombre: plainSector.nombre,
      descripcion: plainSector.descripcion,
      esGeneral: plainSector.esGeneral,
      activo: plainSector.activo,
      createdAt: (plainSector as { createdAt?: Date }).createdAt,
      updatedAt: (plainSector as { updatedAt?: Date }).updatedAt,
    };

    return plainToInstance(SectorResponseDto, source, {
      excludeExtraneousValues: true,
    });
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as { code?: number }).code === 11000
    );
  }

  private extractMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return fallback;
  }
}
