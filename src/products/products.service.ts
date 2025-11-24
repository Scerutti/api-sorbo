
import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { plainToInstance } from 'class-transformer';
import { Model } from 'mongoose';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product, ProductDocument } from './schemas/product.schema';
import { ProductContract } from '../shared/types/product.types';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
  ) {}

  async create(
    createProductDto: CreateProductDto,
  ): Promise<ProductResponseDto> {
    try {
      const createdProduct = await this.productModel.create({
        nombre: createProductDto.nombre,
        tipo: createProductDto.tipo,
        precioCosto: createProductDto.precioCosto,
        porcentajeGanancia: createProductDto.porcentajeGanancia,
        porcentajeGananciaMayorista: createProductDto.porcentajeGananciaMayorista ?? 0,
        stock: createProductDto.stock,
        soldCount: createProductDto.soldCount ?? 0,
      });

      return this.mapToDto(createdProduct);
    } catch (error) {
      throw new HttpException(
        this.extractMessage(error, 'No se pudo crear el producto'),
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async findAll(): Promise<ProductResponseDto[]> {
    const products = await this.productModel.find().exec();
    return products.map((product) => this.mapToDto(product));
  }

  async findOne(id: string): Promise<ProductResponseDto> {
    const product = await this.productModel.findById(id).exec();
    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    return this.mapToDto(product);
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    try {
      const updatedProduct = await this.productModel
        .findByIdAndUpdate(id, updateProductDto, {
          new: true,
          runValidators: true,
        })
        .exec();

      if (!updatedProduct) {
        throw new NotFoundException('Producto no encontrado');
      }

      return this.mapToDto(updatedProduct);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        this.extractMessage(error, 'No se pudo actualizar el producto'),
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async remove(id: string): Promise<void> {
    const deletedProduct = await this.productModel.findByIdAndDelete(id).exec();
    if (!deletedProduct) {
      throw new NotFoundException('Producto no encontrado');
    }
  }

  private mapToDto(product: ProductDocument): ProductResponseDto {
    const plainProduct = product.toObject() as unknown as ProductContract;

    return plainToInstance(ProductResponseDto, plainProduct, {
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
