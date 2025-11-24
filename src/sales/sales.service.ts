
import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { plainToInstance } from 'class-transformer';
import { Model } from 'mongoose';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { CreateSaleDto, CreateSaleItemDto } from './dto/create-sale.dto';
import { SaleResponseDto } from './dto/sale-response.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { Sale, SaleDocument } from './schemas/sale.schema';
import { SaleContract } from '../shared/types/sales.types';

interface PreparedSalePayload {
  fecha: Date;
  items: Sale['items'];
  total: number;
  esMayorista: boolean;
  vendedorId?: string;
}

@Injectable()
export class SalesService {
  constructor(
    @InjectModel(Sale.name) private readonly saleModel: Model<SaleDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
  ) {}

  async create(
    createSaleDto: CreateSaleDto,
    vendedorId?: string,
  ): Promise<SaleResponseDto> {
    try {
      const payload = await this.prepareSalePayload(createSaleDto, vendedorId);
      const createdSale = await this.saleModel.create(payload);
      return this.mapToDto(createdSale);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        this.extractMessage(error, 'No se pudo crear la venta'),
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async findAll(): Promise<SaleResponseDto[]> {
    const sales = await this.saleModel.find().exec();
    return sales.map((sale) => this.mapToDto(sale));
  }

  async findOne(id: string): Promise<SaleResponseDto> {
    const sale = await this.saleModel.findById(id).exec();
    if (!sale) {
      throw new NotFoundException('Venta no encontrada');
    }

    return this.mapToDto(sale);
  }

  async update(
    id: string,
    updateSaleDto: UpdateSaleDto,
  ): Promise<SaleResponseDto> {
    try {
      // Obtener la venta actual para mantener esMayorista si no se actualiza
      const currentSale = await this.saleModel.findById(id).exec();
      if (!currentSale) {
        throw new NotFoundException('Venta no encontrada');
      }

      const payload: Partial<Sale> = {};

      if (typeof updateSaleDto.fecha === 'string') {
        payload.fecha = new Date(updateSaleDto.fecha);
      }

      const esMayorista =
        typeof updateSaleDto.esMayorista === 'boolean'
          ? updateSaleDto.esMayorista
          : currentSale.esMayorista;

      if (typeof updateSaleDto.esMayorista === 'boolean') {
        payload.esMayorista = updateSaleDto.esMayorista;
      }

      if (Array.isArray(updateSaleDto.items)) {
        const items = await this.buildItems(updateSaleDto.items, esMayorista);
        payload.items = items;
        payload.total = this.calculateTotal(items);
      }

      const updatedSale = await this.saleModel
        .findByIdAndUpdate(id, payload, { new: true, runValidators: true })
        .exec();

      if (!updatedSale) {
        throw new NotFoundException('Venta no encontrada');
      }

      return this.mapToDto(updatedSale);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        this.extractMessage(error, 'No se pudo actualizar la venta'),
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async remove(id: string): Promise<void> {
    const deletedSale = await this.saleModel.findByIdAndDelete(id).exec();
    if (!deletedSale) {
      throw new NotFoundException('Venta no encontrada');
    }
  }

  private async prepareSalePayload(
    dto: CreateSaleDto,
    vendedorId?: string,
  ): Promise<PreparedSalePayload> {
    const fecha = dto.fecha ? new Date(dto.fecha) : new Date();
    const esMayorista = dto.esMayorista ?? false;
    const items = await this.buildItems(dto.items, esMayorista);
    const total = this.calculateTotal(items);

    return {
      fecha,
      items,
      total,
      esMayorista,
      ...(vendedorId ? { vendedorId } : {}),
    };
  }

  private async buildItems(
    items: CreateSaleItemDto[],
    esMayorista: boolean,
  ): Promise<Sale['items']> {
    return Promise.all(
      items.map(async (item) => {
        const product = await this.productModel.findById(item.productId).exec();
        if (!product) {
          throw new NotFoundException(
            `Producto ${item.productId} no encontrado`,
          );
        }

        // Determinar qué porcentaje usar según si es venta mayorista
        const porcentajeGanancia =
          esMayorista && product.porcentajeGananciaMayorista > 0
            ? product.porcentajeGananciaMayorista
            : product.porcentajeGanancia;

        // Calcular precioVenta del producto: precioCosto * (1 + porcentajeGanancia / 100)
        // El frontend puede enviar precioUnitario, si no, se calcula aquí
        const precioVentaCalculado =
          product.precioCosto * (1 + porcentajeGanancia / 100);
        const precioUnitario = item.precioUnitario ?? precioVentaCalculado;

        // Construir snapshot con ambos porcentajes si es mayorista
        const snapshot: Sale['items'][0]['snapshot'] = {
          precioCosto: product.precioCosto,
          costos: 0, // Nota: Los costos se calculan en el frontend, aquí se guarda 0 como placeholder
          porcentajeGanancia: product.porcentajeGanancia,
          precioVenta: precioUnitario, // Usar el precio unitario calculado/usado
        };

        // Si es mayorista y el producto tiene porcentaje mayorista, guardarlo en el snapshot
        if (esMayorista && product.porcentajeGananciaMayorista > 0) {
          snapshot.porcentajeGananciaMayorista =
            product.porcentajeGananciaMayorista;
        }

        return {
          productId: product._id,
          productNombre: product.nombre,
          cantidad: item.cantidad,
          precioUnitario,
          snapshot,
        };
      }),
    );
  }

  private calculateTotal(items: Sale['items']): number {
    return items.reduce(
      (acc, item) => acc + item.precioUnitario * item.cantidad,
      0,
    );
  }

  private mapToDto(sale: SaleDocument): SaleResponseDto {
    const plainSale = sale.toObject();
    const typedPlainSale: {
      fecha: Date;
      items: Array<{
        productId: { toString(): string } | string;
        productNombre: string;
        cantidad: number;
        precioUnitario: number;
        snapshot: {
          precioCosto: number;
          costos: number;
          porcentajeGanancia: number;
          porcentajeGananciaMayorista?: number;
          precioVenta: number;
        };
      }>;
      total: number;
      esMayorista: boolean;
      vendedorId?: { toString(): string } | string;
    } = plainSale as {
      fecha: Date;
      items: Array<{
        productId: { toString(): string } | string;
        productNombre: string;
        cantidad: number;
        precioUnitario: number;
        snapshot: {
          precioCosto: number;
          costos: number;
          porcentajeGanancia: number;
          porcentajeGananciaMayorista?: number;
          precioVenta: number;
        };
      }>;
      total: number;
      esMayorista: boolean;
      vendedorId?: { toString(): string } | string;
    };

    const saleContract: SaleContract = {
      id: String(sale.id),
      fecha: typedPlainSale.fecha,
      items: typedPlainSale.items.map((item) => ({
        productId:
          typeof item.productId === 'string'
            ? item.productId
            : item.productId.toString(),
        productNombre: item.productNombre,
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        snapshot: {
          precioCosto: item.snapshot.precioCosto,
          costos: item.snapshot.costos,
          porcentajeGanancia: item.snapshot.porcentajeGanancia,
          ...(item.snapshot.porcentajeGananciaMayorista
            ? { porcentajeGananciaMayorista: item.snapshot.porcentajeGananciaMayorista }
            : {}),
          precioVenta: item.snapshot.precioVenta,
        },
      })),
      total: typedPlainSale.total,
      esMayorista: typedPlainSale.esMayorista ?? false,
      ...(typedPlainSale.vendedorId
        ? {
            vendedorId:
              typeof typedPlainSale.vendedorId === 'string'
                ? typedPlainSale.vendedorId
                : typedPlainSale.vendedorId.toString(),
          }
        : {}),
    };
    return plainToInstance(SaleResponseDto, saleContract, {
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
