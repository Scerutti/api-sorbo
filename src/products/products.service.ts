
import {
  BadRequestException,
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { plainToInstance } from 'class-transformer';
import { Model, Types } from 'mongoose';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product, ProductDocument } from './schemas/product.schema';
import { ProductContract } from '../shared/types/product.types';
import { CostsService } from '../costs/costs.service';
import {
  TipoCosto,
  TipoCostoDocument,
} from '../tipos-costo/schemas/tipo-costo.schema';

/**
 * Contexto de precios resuelto una sola vez por request para no hacer
 * una consulta de costos por producto.
 */
export interface PricingContext {
  // Suma de los costos cuyos tipos tienen aplicaATodos = true.
  costosGlobales: number;
  // Suma de costos por tipo, solo para tipos asignables (aplicaATodos = false).
  costosPorTipo: Map<string, number>;
  tipoNombres: Map<string, string>;
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(TipoCosto.name)
    private readonly tipoCostoModel: Model<TipoCostoDocument>,
    @Inject(forwardRef(() => CostsService))
    private readonly costsService: CostsService,
  ) {}

  async create(
    createProductDto: CreateProductDto,
  ): Promise<ProductResponseDto> {
    try {
      await this.assertTipoExists(createProductDto.tipoId);

      const createdProduct = await this.productModel.create({
        nombre: createProductDto.nombre,
        descripcion: createProductDto.descripcion,
        tipoId: new Types.ObjectId(createProductDto.tipoId),
        precioCosto: createProductDto.precioCosto,
        porcentajeGanancia: createProductDto.porcentajeGanancia,
        porcentajeGananciaMayorista:
          createProductDto.porcentajeGananciaMayorista ?? 0,
        stock: createProductDto.stock,
        soldCount: createProductDto.soldCount ?? 0,
      });

      return this.mapToDto(createdProduct, await this.buildPricingContext());
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        this.extractMessage(error, 'No se pudo crear el producto'),
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async findAll(): Promise<ProductResponseDto[]> {
    const [products, pricing] = await Promise.all([
      this.productModel.find().exec(),
      this.buildPricingContext(),
    ]);
    return products.map((product) => this.mapToDto(product, pricing));
  }

  async findOne(id: string): Promise<ProductResponseDto> {
    const product = await this.productModel.findById(id).exec();
    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    return this.mapToDto(product, await this.buildPricingContext());
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    try {
      const payload: Record<string, unknown> = { ...updateProductDto };

      if (typeof updateProductDto.tipoId !== 'undefined') {
        await this.assertTipoExists(updateProductDto.tipoId);
        payload.tipoId = new Types.ObjectId(updateProductDto.tipoId);
      }

      const updatedProduct = await this.productModel
        .findByIdAndUpdate(id, payload, {
          new: true,
          runValidators: true,
        })
        .exec();

      if (!updatedProduct) {
        throw new NotFoundException('Producto no encontrado');
      }

      return this.mapToDto(updatedProduct, await this.buildPricingContext());
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

  /**
   * Costos aplicables a un producto:
   *   costos globales (tipos con aplicaATodos) + costos del tipo del producto.
   */
  async buildPricingContext(): Promise<PricingContext> {
    const [costs, tipos] = await Promise.all([
      this.costsService.findAll(),
      this.tipoCostoModel.find().exec(),
    ]);

    const tipoNombres = new Map<string, string>();
    const tiposGlobales = new Set<string>();

    for (const tipo of tipos) {
      const tipoId = tipo._id.toString();
      tipoNombres.set(tipoId, tipo.nombre);
      if (tipo.aplicaATodos) {
        tiposGlobales.add(tipoId);
      }
    }

    let costosGlobales = 0;
    const costosPorTipo = new Map<string, number>();

    for (const cost of costs) {
      const tipoId = cost.tipoId;
      const valor = cost.valor ?? 0;

      if (tiposGlobales.has(tipoId)) {
        costosGlobales += valor;
      } else {
        costosPorTipo.set(tipoId, (costosPorTipo.get(tipoId) ?? 0) + valor);
      }
    }

    return { costosGlobales, costosPorTipo, tipoNombres };
  }

  /**
   * Costos aplicables a un tipo dado, usando un contexto ya construido.
   * Lo usa SalesService para congelar el snapshot de la venta.
   */
  computeCostos(tipoId: string, pricing: PricingContext): number {
    return this.round2(
      pricing.costosGlobales + (pricing.costosPorTipo.get(tipoId) ?? 0),
    );
  }

  private async assertTipoExists(tipoId: string): Promise<void> {
    const exists = await this.tipoCostoModel.exists({
      _id: new Types.ObjectId(tipoId),
    });
    if (!exists) {
      throw new BadRequestException('El tipo de costo indicado no existe.');
    }
  }

  private mapToDto(
    product: ProductDocument,
    pricing: PricingContext,
  ): ProductResponseDto {
    const plainProduct = product.toObject();
    const tipoId = product.tipoId ? product.tipoId.toString() : '';

    const costos = this.computeCostos(tipoId, pricing);

    const base = (plainProduct.precioCosto ?? 0) + costos;
    const precioVenta = this.round2(
      base * (1 + (plainProduct.porcentajeGanancia ?? 0) / 100),
    );
    const precioVentaMayorista = this.round2(
      base * (1 + (plainProduct.porcentajeGananciaMayorista ?? 0) / 100),
    );

    const source: ProductContract = {
      id: product.id as string,
      nombre: plainProduct.nombre,
      descripcion: plainProduct.descripcion,
      tipoId,
      tipoNombre: pricing.tipoNombres.get(tipoId) ?? '',
      precioCosto: plainProduct.precioCosto,
      porcentajeGanancia: plainProduct.porcentajeGanancia,
      porcentajeGananciaMayorista: plainProduct.porcentajeGananciaMayorista,
      costos,
      precioVenta,
      precioVentaMayorista,
      stock: plainProduct.stock,
      soldCount: plainProduct.soldCount,
      createdAt: (plainProduct as { createdAt?: Date }).createdAt,
      updatedAt: (plainProduct as { updatedAt?: Date }).updatedAt,
    };

    return plainToInstance(ProductResponseDto, source, {
      excludeExtraneousValues: true,
    });
  }

  private round2(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private extractMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    return fallback;
  }
}
