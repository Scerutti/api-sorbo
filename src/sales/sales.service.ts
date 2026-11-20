import {
  BadRequestException,
  ForbiddenException,
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
import * as ExcelJS from 'exceljs';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { ProductsService } from '../products/products.service';
import { StockService } from '../stock/stock.service';
import { UserRole } from '../shared/enums/user-role.enum';
import type { UserDocument } from '../users/schemas/user.schema';
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
  sectorId: Types.ObjectId;
  vendedorId?: string;
}

@Injectable()
export class SalesService {
  constructor(
    @InjectModel(Sale.name) private readonly saleModel: Model<SaleDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @Inject(forwardRef(() => ProductsService))
    private readonly productsService: ProductsService,
    private readonly stockService: StockService,
  ) {}

  async create(
    createSaleDto: CreateSaleDto,
    vendedor: UserDocument,
  ): Promise<SaleResponseDto> {
    const vendedorId = String(vendedor.id ?? vendedor._id);
    const sectorId = this.resolveSectorId(createSaleDto, vendedor);

    try {
      await this.stockService.assertSectorOperativo(sectorId);

      const payload = await this.prepareSalePayload(
        createSaleDto,
        sectorId,
        vendedorId,
      );
      const createdSale = await this.saleModel.create(payload);

      await this.descontarLineas(createdSale, sectorId, vendedorId);
      await this.ajustarSoldCount(createdSale.items, 1);

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

  /**
   * Lista las ventas dentro del rango de fechas indicado (ordenadas por fecha).
   * Usado por el reporte mensual de gastos/ingresos.
   */
  async findByDateRange(
    fechaDesde?: string,
    fechaHasta?: string,
  ): Promise<SaleResponseDto[]> {
    const filter = this.buildDateFilter(fechaDesde, fechaHasta);
    const sales = await this.saleModel.find(filter).sort({ fecha: 1 }).exec();
    return sales.map((sale) => this.mapToDto(sale));
  }

  /**
   * Suma el total de ventas (ingresos) dentro del rango de fechas indicado.
   */
  async sumTotalByDateRange(
    fechaDesde?: string,
    fechaHasta?: string,
  ): Promise<number> {
    const filter = this.buildDateFilter(fechaDesde, fechaHasta);
    const sales = await this.saleModel.find(filter).exec();
    return sales.reduce((acc, sale) => acc + sale.total, 0);
  }

  private buildDateFilter(
    fechaDesde?: string,
    fechaHasta?: string,
  ): Record<string, unknown> {
    const filter: Record<string, unknown> = {};
    if (fechaDesde || fechaHasta) {
      const rango: Record<string, Date> = {};
      if (fechaDesde) {
        rango.$gte = new Date(fechaDesde);
      }
      if (fechaHasta) {
        rango.$lte = new Date(fechaHasta);
      }
      filter.fecha = rango;
    }
    return filter;
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
    usuario: UserDocument,
  ): Promise<SaleResponseDto> {
    const usuarioId = String(usuario.id ?? usuario._id);

    try {
      // Obtener la venta actual para mantener esMayorista si no se actualiza
      const currentSale = await this.saleModel.findById(id).exec();
      if (!currentSale) {
        throw new NotFoundException('Venta no encontrada');
      }

      this.assertPuedeOperarVenta(currentSale, usuario);

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

      // El stock se mueve contra el sector guardado en la venta, no contra
      // el del usuario que edita: las unidades tienen que volver al mismo
      // lugar de donde salieron.
      const sectorId = this.sectorDeLaVenta(currentSale);
      let stockMovido = false;

      if (Array.isArray(updateSaleDto.items)) {
        const items = await this.buildItems(updateSaleDto.items, esMayorista);
        payload.items = items;
        payload.total = this.calculateTotal(items);

        if (sectorId) {
          await this.aplicarDiferenciaDeStock(
            currentSale.items,
            items,
            sectorId,
            id,
            usuarioId,
          );
          stockMovido = true;
        }
      }

      // Si la venta no se puede guardar, el stock ya movido se deshace: si
      // no, el sector quedaria con unidades descontadas (o repuestas) por una
      // edicion que nunca se registro.
      const revertirStock = async (): Promise<void> => {
        if (stockMovido && sectorId && payload.items) {
          await this.aplicarDiferenciaDeStock(
            payload.items,
            currentSale.items,
            sectorId,
            id,
            usuarioId,
          );
        }
      };

      let updatedSale: SaleDocument | null;
      try {
        updatedSale = await this.saleModel
          .findByIdAndUpdate(id, payload, { new: true, runValidators: true })
          .exec();
      } catch (error) {
        await revertirStock();
        throw error;
      }

      if (!updatedSale) {
        await revertirStock();
        throw new NotFoundException('Venta no encontrada');
      }

      // soldCount recien cuando la edicion quedo guardada.
      if (payload.items) {
        await this.ajustarSoldCountPorDiferencia(
          currentSale.items,
          payload.items,
        );
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

  async remove(id: string, usuario: UserDocument): Promise<void> {
    const usuarioId = String(usuario.id ?? usuario._id);

    const sale = await this.saleModel.findById(id).exec();
    if (!sale) {
      throw new NotFoundException('Venta no encontrada');
    }
    this.assertPuedeOperarVenta(sale, usuario);

    const deletedSale = await this.saleModel.findByIdAndDelete(id).exec();
    if (!deletedSale) {
      throw new NotFoundException('Venta no encontrada');
    }

    // Las unidades vuelven al sector del que salieron.
    const sectorId = this.sectorDeLaVenta(deletedSale);
    if (sectorId) {
      for (const item of deletedSale.items) {
        await this.stockService.reponerPorVenta(
          item.productId.toString(),
          sectorId,
          item.cantidad,
          id,
          usuarioId,
        );
      }
    }

    await this.ajustarSoldCount(deletedSale.items, -1);
  }

  async generateSaleExcel(
    id: string,
  ): Promise<{ workbook: ExcelJS.Workbook; fileName: string }> {
    const sale = await this.saleModel.findById(id).exec();
    if (!sale) {
      throw new NotFoundException('Venta no encontrada');
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Detalle de venta');

    worksheet.columns = [
    { header: 'Producto', key: 'nombre', width: 35 },
    { header: 'Cantidad', key: 'cantidad', width: 12 },
    { header: 'Precio Unitario', key: 'precioUnitario', width: 18 },
    { header: 'Total por Producto', key: 'subtotal', width: 22 },
    { header: 'TOTAL VENTA', key: 'totalGeneral', width: 20 },
  ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F81BD' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };


    sale.items.forEach((item) => {
        worksheet.addRow({
          nombre: item.productNombre,
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario,
          subtotal: item.cantidad * item.precioUnitario,
        });
      });

    worksheet.getColumn('precioUnitario').numFmt = '$#,##0.00';
    worksheet.getColumn('subtotal').numFmt = '$#,##0.00';
    worksheet.getColumn('totalGeneral').numFmt = '$#,##0.00';

    worksheet.addRow([]);

    const lastRow = worksheet.addRow({
      subtotal: 'TOTAL FINAL:',
      totalGeneral: sale.total
    });

    lastRow.getCell('subtotal').font = { bold: true };
    lastRow.getCell('totalGeneral').font = {
      bold: true,
      size: 12,
      color: { argb: 'FFC00000' }
    };

    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });

    const fechaVenta = sale.fecha.toISOString().split('T')[0];
    const fileName = `sorbo_sabores_venta_${id.substring(id.length - 5)}_${fechaVenta}.xlsx`;

    return { workbook, fileName };
  }

  private async prepareSalePayload(
    dto: CreateSaleDto,
    sectorId: string,
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
      sectorId: new Types.ObjectId(sectorId),
      ...(vendedorId ? { vendedorId } : {}),
    };
  }

  private async buildItems(
    items: CreateSaleItemDto[],
    esMayorista: boolean,
  ): Promise<Sale['items']> {
    // Contexto de precios resuelto una sola vez para toda la venta.
    const pricing = await this.productsService.buildPricingContext();

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

        // Costos aplicables al producto (globales + los de su tipo).
        const costos = this.productsService.computeCostos(
          product.tipoId ? product.tipoId.toString() : '',
          pricing,
        );

        // precioVenta = (precioCosto + costos) * (1 + porcentajeGanancia / 100)
        // El frontend puede enviar precioUnitario; si no, se calcula aquí.
        const precioVentaCalculado =
          (product.precioCosto + costos) * (1 + porcentajeGanancia / 100);
        const precioUnitario = item.precioUnitario ?? precioVentaCalculado;

        // Construir snapshot con ambos porcentajes si es mayorista
        const snapshot: Sale['items'][0]['snapshot'] = {
          precioCosto: product.precioCosto,
          costos, // Congelado al momento de la venta para auditoría histórica
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
      ...(sale.sectorId ? { sectorId: sale.sectorId.toString() } : {}),
    };
    return plainToInstance(SaleResponseDto, saleContract, {
      excludeExtraneousValues: true,
    });
  }

  /**
   * Sector del que sale el stock de una venta nueva.
   *
   * Por defecto el del vendedor. Un admin puede registrar en otro sector
   * mandando sectorId; para cualquier otro rol eso seria vender stock ajeno.
   */
  private resolveSectorId(
    dto: CreateSaleDto,
    vendedor: UserDocument,
  ): string {
    const propio = vendedor.sectorId
      ? vendedor.sectorId.toString()
      : undefined;

    if (!dto.sectorId) {
      if (!propio) {
        throw new BadRequestException(
          'El usuario no tiene un sector asignado. Asignale uno antes de registrar ventas.',
        );
      }
      return propio;
    }

    if (dto.sectorId !== propio && !vendedor.roles.includes(UserRole.ADMIN)) {
      throw new ForbiddenException(
        'Solo un admin puede registrar una venta en un sector que no es el suyo.',
      );
    }

    return dto.sectorId;
  }

  /**
   * Editar o anular una venta mueve stock del sector de esa venta. Con la
   * misma regla que el alta, solo un admin puede tocar ventas de un sector
   * que no es el suyo. Las ventas viejas sin sector quedan solo para admin,
   * porque no hay forma de saber a quien le pertenecen.
   */
  private assertPuedeOperarVenta(
    sale: SaleDocument,
    usuario: UserDocument,
  ): void {
    if (usuario.roles.includes(UserRole.ADMIN)) {
      return;
    }

    const sectorVenta = this.sectorDeLaVenta(sale);
    const propio = usuario.sectorId ? usuario.sectorId.toString() : undefined;
    if (!sectorVenta || sectorVenta !== propio) {
      throw new ForbiddenException(
        'Solo un admin puede modificar o anular una venta de otro sector.',
      );
    }
  }

  /**
   * Sector guardado en la venta. Las ventas anteriores al stock por sector no
   * lo tienen: en ese caso no hay a donde devolver las unidades, asi que el
   * llamador se saltea el movimiento en lugar de inventar un sector.
   */
  private sectorDeLaVenta(sale: SaleDocument): string | undefined {
    return sale.sectorId ? sale.sectorId.toString() : undefined;
  }

  /**
   * Descuenta las lineas de una venta recien creada.
   *
   * Sin transaccion las lineas no son atomicas entre si, asi que si una falla
   * se devuelven las ya descontadas y se borra la venta. Queda como si nunca
   * se hubiera registrado, en vez de dejar stock evaporado y una venta a medias.
   */
  private async descontarLineas(
    sale: SaleDocument,
    sectorId: string,
    usuarioId: string,
  ): Promise<void> {
    const saleId = String(sale.id);
    const descontadas: Sale['items'] = [];

    try {
      for (const item of sale.items) {
        await this.stockService.descontarPorVenta(
          item.productId.toString(),
          sectorId,
          item.cantidad,
          saleId,
          usuarioId,
        );
        descontadas.push(item);
      }
    } catch (error) {
      for (const item of descontadas) {
        await this.stockService.reponerPorVenta(
          item.productId.toString(),
          sectorId,
          item.cantidad,
          saleId,
          usuarioId,
          'Reversa de venta fallida',
        );
      }
      await this.saleModel.findByIdAndDelete(saleId).exec();
      throw error;
    }
  }

  /**
   * Lleva el stock del sector de una cantidad vendida a otra.
   *
   * Trabaja por diferencia en vez de devolver todo y volver a descontar: son
   * menos operaciones y evita rechazar una edicion que en neto no necesita
   * mas stock del que ya habia.
   */
  private async aplicarDiferenciaDeStock(
    oldItems: Sale['items'],
    newItems: Sale['items'],
    sectorId: string,
    saleId: string,
    usuarioId?: string,
  ): Promise<void> {
    const deltas = this.calcularDeltas(oldItems, newItems);
    const aplicados: Array<{ productId: string; delta: number }> = [];

    try {
      for (const [productId, delta] of deltas) {
        if (delta === 0) {
          continue;
        }

        if (delta > 0) {
          await this.stockService.descontarPorVenta(
            productId,
            sectorId,
            delta,
            saleId,
            usuarioId,
          );
        } else {
          await this.stockService.reponerPorVenta(
            productId,
            sectorId,
            -delta,
            saleId,
            usuarioId,
            'Edición de venta',
          );
        }

        aplicados.push({ productId, delta });
      }
    } catch (error) {
      for (const aplicado of aplicados) {
        if (aplicado.delta > 0) {
          await this.stockService.reponerPorVenta(
            aplicado.productId,
            sectorId,
            aplicado.delta,
            saleId,
            usuarioId,
            'Reversa de edición fallida',
          );
        } else {
          await this.stockService.descontarPorVenta(
            aplicado.productId,
            sectorId,
            -aplicado.delta,
            saleId,
            usuarioId,
          );
        }
      }
      throw error;
    }
  }

  /** Unidades de mas (positivo) o de menos (negativo) por producto. */
  private calcularDeltas(
    oldItems: Sale['items'],
    newItems: Sale['items'],
  ): Map<string, number> {
    const deltas = new Map<string, number>();

    for (const item of oldItems) {
      const productId = item.productId.toString();
      deltas.set(productId, (deltas.get(productId) ?? 0) - item.cantidad);
    }

    for (const item of newItems) {
      const productId = item.productId.toString();
      deltas.set(productId, (deltas.get(productId) ?? 0) + item.cantidad);
    }

    return deltas;
  }

  /** soldCount sigue siendo global: cuenta ventas, no ubicacion. */
  private async ajustarSoldCount(
    items: Sale['items'],
    signo: 1 | -1,
  ): Promise<void> {
    for (const item of items) {
      await this.productModel
        .findByIdAndUpdate(item.productId.toString(), {
          $inc: { soldCount: signo * item.cantidad },
        })
        .exec();
    }
  }

  private async ajustarSoldCountPorDiferencia(
    oldItems: Sale['items'],
    newItems: Sale['items'],
  ): Promise<void> {
    for (const [productId, delta] of this.calcularDeltas(oldItems, newItems)) {
      if (delta === 0) {
        continue;
      }
      await this.productModel
        .findByIdAndUpdate(productId, { $inc: { soldCount: delta } })
        .exec();
    }
  }


  private extractMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    return fallback;
  }
}
