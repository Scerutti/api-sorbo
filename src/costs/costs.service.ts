
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { plainToInstance } from 'class-transformer';
import { Model, Types } from 'mongoose';
import { CreateCostDto } from './dto/create-cost.dto';
import { CostResponseDto } from './dto/cost-response.dto';
import { UpdateCostDto } from './dto/update-cost.dto';
import { CostItem, CostItemDocument } from './schemas/cost-item.schema';
import { CostItemContract } from '../shared/types/cost.types';
import { GastosService } from '../expenses/gastos.service';
import {
  TipoCosto,
  TipoCostoDocument,
} from '../tipos-costo/schemas/tipo-costo.schema';

@Injectable()
export class CostsService {
  constructor(
    @InjectModel(CostItem.name)
    private readonly costModel: Model<CostItemDocument>,
    @InjectModel(TipoCosto.name)
    private readonly tipoCostoModel: Model<TipoCostoDocument>,
    private readonly gastosService: GastosService,
  ) {}

  async create(createCostDto: CreateCostDto): Promise<CostResponseDto> {
    try {
      await this.assertTipoExists(createCostDto.tipoId);

      const componentes = createCostDto.componentes ?? [];
      const valor = await this.resolveValor(componentes, createCostDto.valor);

      const createdCost = await this.costModel.create({
        nombre: createCostDto.nombre,
        tipoId: new Types.ObjectId(createCostDto.tipoId),
        valor,
        componentes,
        descripcion: createCostDto.descripcion,
      });
      return this.mapToDto(createdCost);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        this.extractMessage(error, 'No se pudo crear el costo'),
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async findAll(): Promise<CostResponseDto[]> {
    const costs = await this.costModel.find().exec();
    const tipoNombres = await this.loadTipoNombres();
    return Promise.all(costs.map((cost) => this.mapToDto(cost, tipoNombres)));
  }

  async findOne(id: string): Promise<CostResponseDto> {
    const cost = await this.costModel.findById(id).exec();
    if (!cost) {
      throw new NotFoundException('Costo no encontrado');
    }
    return this.mapToDto(cost);
  }

  async update(
    id: string,
    updateCostDto: UpdateCostDto,
  ): Promise<CostResponseDto> {
    try {
      const currentCost = await this.costModel.findById(id).exec();
      if (!currentCost) {
        throw new NotFoundException('Costo no encontrado');
      }

      const payload: Record<string, unknown> = {};

      if (typeof updateCostDto.nombre === 'string') {
        payload.nombre = updateCostDto.nombre;
      }
      if (typeof updateCostDto.tipoId !== 'undefined') {
        await this.assertTipoExists(updateCostDto.tipoId);
        payload.tipoId = new Types.ObjectId(updateCostDto.tipoId);
      }
      if (typeof updateCostDto.descripcion !== 'undefined') {
        payload.descripcion = updateCostDto.descripcion;
      }

      const componentes =
        typeof updateCostDto.componentes !== 'undefined'
          ? updateCostDto.componentes
          : currentCost.componentes.map((c) => c.toString());

      const valorChanged = typeof updateCostDto.valor !== 'undefined';
      const componentesChanged =
        typeof updateCostDto.componentes !== 'undefined';

      if (componentesChanged || valorChanged) {
        payload.valor = await this.resolveValor(
          componentes,
          valorChanged ? updateCostDto.valor : currentCost.valor,
        );
      }

      if (componentesChanged) {
        payload.componentes = componentes;
      }

      const updatedCost = await this.costModel
        .findByIdAndUpdate(id, payload, { new: true, runValidators: true })
        .exec();

      if (!updatedCost) {
        throw new NotFoundException('Costo no encontrado');
      }

      return this.mapToDto(updatedCost);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        this.extractMessage(error, 'No se pudo actualizar el costo'),
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async remove(id: string): Promise<void> {
    const deletedCost = await this.costModel.findByIdAndDelete(id).exec();
    if (!deletedCost) {
      throw new NotFoundException('Costo no encontrado');
    }
  }

  private async assertTipoExists(tipoId: string): Promise<void> {
    const exists = await this.tipoCostoModel.exists({
      _id: new Types.ObjectId(tipoId),
    });
    if (!exists) {
      throw new BadRequestException('El tipo de costo indicado no existe.');
    }
  }

  private async loadTipoNombres(): Promise<Map<string, string>> {
    const tipos = await this.tipoCostoModel.find().select('nombre').exec();
    return new Map(
      tipos.map((tipo) => [tipo._id.toString(), tipo.nombre]),
    );
  }

  private async resolveValor(
    componentes: string[],
    valorManual?: number,
  ): Promise<number> {
    if (componentes.length > 0) {
      return this.gastosService.sumValorUnitario(componentes);
    }
    if (typeof valorManual !== 'number' || Number.isNaN(valorManual)) {
      throw new BadRequestException(
        'Debe indicar un valor o al menos un gasto base (componente).',
      );
    }
    return valorManual;
  }

  private async mapToDto(
    cost: CostItemDocument,
    tipoNombres?: Map<string, string>,
  ): Promise<CostResponseDto> {
    const plainCost = cost.toObject();
    const componentes = (cost.componentes ?? []).map((c) => c.toString());

    if (componentes.length > 0) {
      plainCost.valor = await this.gastosService.sumValorUnitario(componentes);
    }

    const tipoId = cost.tipoId ? cost.tipoId.toString() : '';
    const nombres = tipoNombres ?? (await this.loadTipoNombres());

    const source: CostItemContract = {
      id: cost.id as string,
      nombre: plainCost.nombre,
      tipoId,
      tipoNombre: nombres.get(tipoId) ?? '',
      valor: plainCost.valor,
      componentes,
      descripcion: plainCost.descripcion,
      createdAt: (plainCost as { createdAt?: Date }).createdAt,
      updatedAt: (plainCost as { updatedAt?: Date }).updatedAt,
    };

    return plainToInstance(CostResponseDto, source, {
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
