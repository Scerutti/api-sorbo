
import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { plainToInstance } from 'class-transformer';
import { Model } from 'mongoose';
import { CreateSectorDto } from './dto/create-sector.dto';
import { SectorResponseDto } from './dto/sector-response.dto';
import { UpdateSectorDto } from './dto/update-sector.dto';
import { Sector, SectorDocument } from './schemas/sector.schema';
import { SectorContract } from '../shared/types/sector.types';
import { Sale, SaleDocument } from '../sales/schemas/sale.schema';
import {
  StockSector,
  StockSectorDocument,
} from '../stock/schemas/stock-sector.schema';

@Injectable()
export class SectoresService {
  constructor(
    @InjectModel(Sector.name)
    private readonly sectorModel: Model<SectorDocument>,
    @InjectModel(StockSector.name)
    private readonly stockSectorModel: Model<StockSectorDocument>,
    @InjectModel(Sale.name)
    private readonly saleModel: Model<SaleDocument>,
  ) {}

  async create(createSectorDto: CreateSectorDto): Promise<SectorResponseDto> {
    try {
      const createdSector = await this.sectorModel.create({
        nombre: createSectorDto.nombre,
        descripcion: createSectorDto.descripcion,
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

      const payload: Partial<Sector> = {};

      if (typeof updateSectorDto.nombre === 'string') {
        payload.nombre = updateSectorDto.nombre;
      }
      if (typeof updateSectorDto.descripcion !== 'undefined') {
        payload.descripcion = updateSectorDto.descripcion;
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

    // Borrar un sector con saldo haria desaparecer ese stock del total sin
    // dejar rastro. Hay que vaciarlo antes, transfiriendo a otro sector.
    const productosConSaldo = await this.stockSectorModel
      .countDocuments({ sectorId: sector._id, cantidad: { $gt: 0 } })
      .exec();

    if (productosConSaldo > 0) {
      throw new ConflictException(
        `No se puede eliminar: el sector tiene stock de ${productosConSaldo} producto(s). Transferilo a otro sector primero.`,
      );
    }

    // Las ventas guardan el sector para devolverle las unidades si se
    // anulan. Si el sector ya no existe, esa anulacion crearia un saldo en un
    // sector fantasma que suma al total pero no aparece en ningun listado.
    // Un sector con ventas se desactiva, no se borra.
    const ventas = await this.saleModel
      .countDocuments({ sectorId: sector._id })
      .exec();

    if (ventas > 0) {
      throw new ConflictException(
        `No se puede eliminar: el sector tiene ${ventas} venta(s) registrada(s). Desactivalo en lugar de borrarlo.`,
      );
    }

    await this.sectorModel.deleteOne({ _id: sector._id }).exec();
    await this.stockSectorModel.deleteMany({ sectorId: sector._id }).exec();
  }

  private mapToDto(sector: SectorDocument): SectorResponseDto {
    const plainSector = sector.toObject();

    const source: SectorContract = {
      id: sector.id as string,
      nombre: plainSector.nombre,
      descripcion: plainSector.descripcion,
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
