
import {
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

@Injectable()
export class CostsService {
  constructor(
    @InjectModel(CostItem.name)
    private readonly costModel: Model<CostItemDocument>,
  ) {}

  async create(createCostDto: CreateCostDto): Promise<CostResponseDto> {
    try {
      const createdCost = await this.costModel.create(createCostDto);
      return this.mapToDto(createdCost);
    } catch (error) {
      throw new HttpException(
        this.extractMessage(error, 'No se pudo crear el costo'),
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async findAll(): Promise<CostResponseDto[]> {
    const costs = await this.costModel.find().exec();
    return costs.map((cost) => this.mapToDto(cost));
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
      const updatedCost = await this.costModel
        .findByIdAndUpdate(id, updateCostDto, {
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

  private mapToDto(cost: CostItemDocument): CostResponseDto {
    const plainCost = cost.toObject();

    return plainToInstance(CostResponseDto, plainCost as CostItemContract, {
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
