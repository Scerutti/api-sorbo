
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { plainToInstance } from 'class-transformer';
import { Model } from 'mongoose';
import { CreateCostDto } from './dto/create-cost.dto';
import { CostResponseDto } from './dto/cost-response.dto';
import { UpdateCostDto } from './dto/update-cost.dto';
import { CostItem, CostItemDocument } from './schemas/cost-item.schema';
import { CostItemContract } from '../shared/types/cost.types';
import { GastosService } from '../expenses/gastos.service';

@Injectable()
export class CostsService {
  constructor(
    @InjectModel(CostItem.name)
    private readonly costModel: Model<CostItemDocument>,
    private readonly gastosService: GastosService,
  ) {}

  async create(createCostDto: CreateCostDto): Promise<CostResponseDto> {
    try {
      const componentes = createCostDto.componentes ?? [];
      const valor = await this.resolveValor(componentes, createCostDto.valor);

      const createdCost = await this.costModel.create({
        nombre: createCostDto.nombre,
        tipo: createCostDto.tipo,
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
    return Promise.all(costs.map((cost) => this.mapToDto(cost)));
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

      const payload: Partial<CostItem> = {};

      if (typeof updateCostDto.nombre === 'string') {
        payload.nombre = updateCostDto.nombre;
      }
      if (typeof updateCostDto.tipo !== 'undefined') {
        payload.tipo = updateCostDto.tipo;
      }
      if (typeof updateCostDto.descripcion !== 'undefined') {
        payload.descripcion = updateCostDto.descripcion;
      }

      // Determinar la lista de componentes resultante: la nueva si vino en el
      // payload, sino la que ya tenía el costo.
      const componentes =
        typeof updateCostDto.componentes !== 'undefined'
          ? updateCostDto.componentes
          : currentCost.componentes.map((c) => c.toString());

      // Recalcular `valor` si cambian los componentes o si vino un valor manual.
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
        payload.componentes = componentes as unknown as CostItem['componentes'];
      }

      const updatedCost = await this.costModel
        .findByIdAndUpdate(id, payload, {
          new: true,
          runValidators: true,
        })
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

  /**
   * Calcula el valor efectivo del costo:
   * - Si tiene componentes (gastos base), suma sus valorUnitario actuales.
   * - Si no, usa el valor manual (debe venir informado).
   */
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

  private async mapToDto(cost: CostItemDocument): Promise<CostResponseDto> {
    const plainCost = cost.toObject();

    // Normalizar componentes a strings estables (los ObjectId de Mongoose se
    // serializan de forma inconsistente vía class-transformer).
    const componentes = (cost.componentes ?? []).map((c) => c.toString());

    // Recalcular dinámicamente el valor cuando el costo está compuesto por
    // gastos base, de modo que cambios en esos gastos se reflejen al leer.
    if (componentes.length > 0) {
      plainCost.valor = await this.gastosService.sumValorUnitario(componentes);
    }

    const source: CostItemContract = {
      id: cost.id as string,
      nombre: plainCost.nombre,
      tipo: plainCost.tipo,
      valor: plainCost.valor,
      componentes,
      descripcion: plainCost.descripcion,
      createdAt: (plainCost as { createdAt?: Date }).createdAt,
      updatedAt: (plainCost as { updatedAt?: Date }).updatedAt,
    } as CostItemContract;

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
