
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
import { CreateTipoCostoDto } from './dto/create-tipo-costo.dto';
import { TipoCostoResponseDto } from './dto/tipo-costo-response.dto';
import { UpdateTipoCostoDto } from './dto/update-tipo-costo.dto';
import { TipoCosto, TipoCostoDocument } from './schemas/tipo-costo.schema';
import { CostItem, CostItemDocument } from '../costs/schemas/cost-item.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { TipoCostoContract } from '../shared/types/tipo-costo.types';

@Injectable()
export class TiposCostoService {
  constructor(
    @InjectModel(TipoCosto.name)
    private readonly tipoCostoModel: Model<TipoCostoDocument>,
    @InjectModel(CostItem.name)
    private readonly costItemModel: Model<CostItemDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
  ) {}

  async create(
    createTipoCostoDto: CreateTipoCostoDto,
  ): Promise<TipoCostoResponseDto> {
    try {
      const createdTipo = await this.tipoCostoModel.create({
        nombre: createTipoCostoDto.nombre,
        descripcion: createTipoCostoDto.descripcion,
        aplicaATodos: createTipoCostoDto.aplicaATodos ?? false,
      });
      return this.mapToDto(createdTipo);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException(
          `Ya existe un tipo de costo con el nombre "${createTipoCostoDto.nombre}".`,
        );
      }
      throw new HttpException(
        this.extractMessage(error, 'No se pudo crear el tipo de costo'),
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async findAll(): Promise<TipoCostoResponseDto[]> {
    const tipos = await this.tipoCostoModel.find().sort({ nombre: 1 }).exec();
    return tipos.map((tipo) => this.mapToDto(tipo));
  }

  async findOne(id: string): Promise<TipoCostoResponseDto> {
    const tipo = await this.tipoCostoModel.findById(id).exec();
    if (!tipo) {
      throw new NotFoundException('Tipo de costo no encontrado');
    }
    return this.mapToDto(tipo);
  }

  async update(
    id: string,
    updateTipoCostoDto: UpdateTipoCostoDto,
  ): Promise<TipoCostoResponseDto> {
    try {
      const payload: Partial<TipoCosto> = {};

      if (typeof updateTipoCostoDto.nombre === 'string') {
        payload.nombre = updateTipoCostoDto.nombre;
      }
      if (typeof updateTipoCostoDto.descripcion !== 'undefined') {
        payload.descripcion = updateTipoCostoDto.descripcion;
      }
      if (typeof updateTipoCostoDto.aplicaATodos !== 'undefined') {
        payload.aplicaATodos = updateTipoCostoDto.aplicaATodos;
      }

      const updatedTipo = await this.tipoCostoModel
        .findByIdAndUpdate(id, payload, { new: true, runValidators: true })
        .exec();

      if (!updatedTipo) {
        throw new NotFoundException('Tipo de costo no encontrado');
      }

      return this.mapToDto(updatedTipo);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException(
          `Ya existe un tipo de costo con el nombre "${updateTipoCostoDto.nombre ?? ''}".`,
        );
      }
      throw new HttpException(
        this.extractMessage(error, 'No se pudo actualizar el tipo de costo'),
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async remove(id: string): Promise<void> {
    const tipo = await this.tipoCostoModel.findById(id).exec();
    if (!tipo) {
      throw new NotFoundException('Tipo de costo no encontrado');
    }

    const [costosEnUso, productosEnUso] = await Promise.all([
      this.costItemModel.countDocuments({ tipoId: tipo._id }).exec(),
      this.productModel.countDocuments({ tipoId: tipo._id }).exec(),
    ]);

    if (costosEnUso > 0 || productosEnUso > 0) {
      const partes: string[] = [];
      if (costosEnUso > 0) {
        partes.push(`${costosEnUso} costo(s)`);
      }
      if (productosEnUso > 0) {
        partes.push(`${productosEnUso} producto(s)`);
      }
      throw new ConflictException(
        `No se puede eliminar: ${partes.join(' y ')} usan este tipo. Reasignalos primero.`,
      );
    }

    await this.tipoCostoModel.findByIdAndDelete(id).exec();
  }

  private mapToDto(tipo: TipoCostoDocument): TipoCostoResponseDto {
    const plainTipo = tipo.toObject();

    const source: TipoCostoContract = {
      id: tipo.id as string,
      nombre: plainTipo.nombre,
      descripcion: plainTipo.descripcion,
      aplicaATodos: plainTipo.aplicaATodos,
      createdAt: (plainTipo as { createdAt?: Date }).createdAt,
      updatedAt: (plainTipo as { updatedAt?: Date }).updatedAt,
    };

    return plainToInstance(TipoCostoResponseDto, source, {
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
