
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { plainToInstance } from 'class-transformer';
import { FilterQuery, Model, Types } from 'mongoose';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { Sector, SectorDocument } from '../sectores/schemas/sector.schema';
import { TipoMovimiento } from '../shared/enums/tipo-movimiento.enum';
import {
  MovimientoStockContract,
  StockResumenContract,
  StockSectorContract,
} from '../shared/types/stock.types';
import { CreateMovimientoDto } from './dto/create-movimiento.dto';
import { FijarSaldosDto } from './dto/fijar-saldos.dto';
import { MovimientoStockResponseDto } from './dto/movimiento-stock-response.dto';
import { QueryMovimientosDto } from './dto/query-movimientos.dto';
import { QueryStockDto } from './dto/query-stock.dto';
import { StockResumenResponseDto } from './dto/stock-resumen-response.dto';
import { StockSectorResponseDto } from './dto/stock-sector-response.dto';
import {
  MovimientoStock,
  MovimientoStockDocument,
} from './schemas/movimiento-stock.schema';
import {
  StockSector,
  StockSectorDocument,
} from './schemas/stock-sector.schema';
import { CambioSaldo, planificarReparto } from './reparto';

const LIMITE_MOVIMIENTOS_POR_DEFECTO = 100;

interface SectorResuelto {
  nombre: string;
  activo: boolean;
}

/** Nombres resueltos una vez por request, para no consultar por fila. */
interface NombresContext {
  productos: Map<string, string>;
  sectores: Map<string, SectorResuelto>;
}

interface DatosMovimiento {
  tipo: TipoMovimiento;
  productId: string;
  sectorOrigenId?: string | undefined;
  sectorDestinoId?: string | undefined;
  cantidad: number;
  motivo?: string | undefined;
  saleId?: string | undefined;
  usuarioId?: string | undefined;
}

@Injectable()
export class StockService {
  constructor(
    @InjectModel(StockSector.name)
    private readonly stockSectorModel: Model<StockSectorDocument>,
    @InjectModel(MovimientoStock.name)
    private readonly movimientoModel: Model<MovimientoStockDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(Sector.name)
    private readonly sectorModel: Model<SectorDocument>,
  ) {}

  // ---------------------------------------------------------------- consultas

  async findSaldos(query: QueryStockDto): Promise<StockSectorResponseDto[]> {
    const filtro: FilterQuery<StockSectorDocument> = {};
    if (query.sectorId) {
      filtro.sectorId = new Types.ObjectId(query.sectorId);
    }
    if (query.productId) {
      filtro.productId = new Types.ObjectId(query.productId);
    }

    const [saldos, nombres] = await Promise.all([
      this.stockSectorModel.find(filtro).exec(),
      this.buildNombres(
        query.productId ? { productIds: [query.productId] } : undefined,
      ),
    ]);

    return saldos
      .map((saldo) => this.mapSaldoToDto(saldo, nombres))
      .sort((a, b) => a.productNombre.localeCompare(b.productNombre, 'es'));
  }

  /**
   * Vista consolidada: por cada producto, el total del emprendimiento y como
   * se reparte. Incluye los sectores en cero para que el control muestre los
   * faltantes y no solo lo que hay.
   */
  async findResumen(productId?: string): Promise<StockResumenResponseDto[]> {
    const filtroProductos: FilterQuery<ProductDocument> = {};
    const filtroSaldos: FilterQuery<StockSectorDocument> = {};
    if (productId) {
      filtroProductos._id = new Types.ObjectId(productId);
      filtroSaldos.productId = new Types.ObjectId(productId);
    }

    const [productos, sectores, saldos] = await Promise.all([
      this.productModel.find(filtroProductos).sort({ nombre: 1 }).exec(),
      this.sectorModel.find().sort({ nombre: 1 }).exec(),
      this.stockSectorModel.find(filtroSaldos).exec(),
    ]);

    // (productId|sectorId) -> cantidad, para no recorrer los saldos por celda.
    const porClave = new Map<string, number>();
    for (const saldo of saldos) {
      porClave.set(
        `${saldo.productId.toString()}|${saldo.sectorId.toString()}`,
        saldo.cantidad,
      );
    }

    const resumen: StockResumenContract[] = productos.map((producto) => {
      const idProducto = producto._id.toString();

      const porSector = sectores.map((sector) => {
        const idSector = sector._id.toString();
        return {
          sectorId: idSector,
          sectorNombre: sector.nombre,
          cantidad: porClave.get(`${idProducto}|${idSector}`) ?? 0,
        };
      });

      return {
        productId: idProducto,
        productNombre: producto.nombre,
        total: porSector.reduce((acc, fila) => acc + fila.cantidad, 0),
        porSector,
      };
    });

    return plainToInstance(StockResumenResponseDto, resumen, {
      excludeExtraneousValues: true,
    });
  }

  async findMovimientos(
    query: QueryMovimientosDto,
  ): Promise<MovimientoStockResponseDto[]> {
    const filtro: FilterQuery<MovimientoStockDocument> = {};

    if (query.productId) {
      filtro.productId = new Types.ObjectId(query.productId);
    }
    if (query.tipo) {
      filtro.tipo = query.tipo;
    }
    if (query.sectorId) {
      // Un sector aparece como origen o como destino; las dos cuentan.
      const idSector = new Types.ObjectId(query.sectorId);
      filtro.$or = [{ sectorOrigenId: idSector }, { sectorDestinoId: idSector }];
    }
    if (query.fechaDesde || query.fechaHasta) {
      const rango: Record<string, Date> = {};
      if (query.fechaDesde) {
        rango.$gte = new Date(query.fechaDesde);
      }
      if (query.fechaHasta) {
        rango.$lte = new Date(query.fechaHasta);
      }
      filtro.fecha = rango;
    }

    const [movimientos, nombres] = await Promise.all([
      this.movimientoModel
        .find(filtro)
        .sort({ fecha: -1 })
        .limit(query.limit ?? LIMITE_MOVIMIENTOS_POR_DEFECTO)
        .exec(),
      this.buildNombres(),
    ]);

    return movimientos.map((movimiento) =>
      this.mapMovimientoToDto(movimiento, nombres),
    );
  }

  // ---------------------------------------------------------------- escritura

  async registrarMovimiento(
    dto: CreateMovimientoDto,
    usuarioId?: string,
  ): Promise<MovimientoStockResponseDto> {
    const producto = await this.productModel.findById(dto.productId).exec();
    if (!producto) {
      throw new NotFoundException('Producto no encontrado');
    }

    switch (dto.tipo) {
      case TipoMovimiento.ENTRADA:
        return this.aplicarEntrada(dto, usuarioId);
      case TipoMovimiento.SALIDA:
        return this.aplicarSalida(dto, usuarioId);
      case TipoMovimiento.TRANSFERENCIA:
        return this.aplicarTransferencia(dto, usuarioId);
      case TipoMovimiento.AJUSTE:
        return this.aplicarAjuste(dto, usuarioId);
      default:
        throw new BadRequestException('Tipo de movimiento no soportado');
    }
  }

  private async aplicarEntrada(
    dto: CreateMovimientoDto,
    usuarioId?: string,
  ): Promise<MovimientoStockResponseDto> {
    const destino = this.requireSector(dto.sectorDestinoId, 'sectorDestinoId');
    this.rejectSector(dto.sectorOrigenId, 'sectorOrigenId', 'una entrada');
    this.requireCantidadPositiva(dto.cantidad);

    await this.assertSectorPuedeRecibir(destino);
    await this.incrementar(dto.productId, destino, dto.cantidad);

    return this.registrarEnLibro({
      tipo: TipoMovimiento.ENTRADA,
      productId: dto.productId,
      sectorDestinoId: destino,
      cantidad: dto.cantidad,
      motivo: dto.motivo,
      usuarioId,
    });
  }

  private async aplicarSalida(
    dto: CreateMovimientoDto,
    usuarioId?: string,
  ): Promise<MovimientoStockResponseDto> {
    const origen = this.requireSector(dto.sectorOrigenId, 'sectorOrigenId');
    this.rejectSector(dto.sectorDestinoId, 'sectorDestinoId', 'una salida');
    this.requireCantidadPositiva(dto.cantidad);

    await this.assertSectorExiste(origen);

    const descontado = await this.decrementarCondicional(
      dto.productId,
      origen,
      dto.cantidad,
    );
    if (!descontado) {
      await this.throwStockInsuficiente(dto.productId, origen, dto.cantidad);
    }

    return this.registrarEnLibro({
      tipo: TipoMovimiento.SALIDA,
      productId: dto.productId,
      sectorOrigenId: origen,
      cantidad: dto.cantidad,
      motivo: dto.motivo,
      usuarioId,
    });
  }

  private async aplicarTransferencia(
    dto: CreateMovimientoDto,
    usuarioId?: string,
  ): Promise<MovimientoStockResponseDto> {
    const origen = this.requireSector(dto.sectorOrigenId, 'sectorOrigenId');
    const destino = this.requireSector(dto.sectorDestinoId, 'sectorDestinoId');
    this.requireCantidadPositiva(dto.cantidad);

    if (origen === destino) {
      throw new BadRequestException(
        'El sector de origen y el de destino no pueden ser el mismo.',
      );
    }

    await this.assertSectorExiste(origen);
    await this.assertSectorPuedeRecibir(destino);

    const descontado = await this.decrementarCondicional(
      dto.productId,
      origen,
      dto.cantidad,
    );
    if (!descontado) {
      await this.throwStockInsuficiente(dto.productId, origen, dto.cantidad);
    }

    try {
      await this.incrementar(dto.productId, destino, dto.cantidad);
    } catch (error) {
      // Sin transaccion no hay atomicidad entre las dos patas: si la segunda
      // falla, devolvemos las unidades al origen para no evaporar stock.
      await this.incrementar(dto.productId, origen, dto.cantidad);
      throw error;
    }

    return this.registrarEnLibro({
      tipo: TipoMovimiento.TRANSFERENCIA,
      productId: dto.productId,
      sectorOrigenId: origen,
      sectorDestinoId: destino,
      cantidad: dto.cantidad,
      motivo: dto.motivo,
      usuarioId,
    });
  }

  /**
   * Lleva el saldo de un sector a un valor absoluto (conteo fisico). Guarda en
   * el libro el delta aplicado, con destino si subio y con origen si bajo.
   */
  private async aplicarAjuste(
    dto: CreateMovimientoDto,
    usuarioId?: string,
  ): Promise<MovimientoStockResponseDto> {
    const sector = this.requireSector(dto.sectorDestinoId, 'sectorDestinoId');
    this.rejectSector(dto.sectorOrigenId, 'sectorOrigenId', 'un ajuste');

    await this.assertSectorExiste(sector);

    const saldoActual = await this.getSaldo(dto.productId, sector);
    const delta = dto.cantidad - saldoActual;

    if (delta === 0) {
      throw new BadRequestException(
        `El saldo ya es ${dto.cantidad}. No hay nada que ajustar.`,
      );
    }

    if (delta > 0) {
      await this.incrementar(dto.productId, sector, delta);
      return this.registrarEnLibro({
        tipo: TipoMovimiento.AJUSTE,
        productId: dto.productId,
        sectorDestinoId: sector,
        cantidad: delta,
        motivo: dto.motivo,
        usuarioId,
      });
    }

    const descontado = await this.decrementarCondicional(
      dto.productId,
      sector,
      -delta,
    );
    if (!descontado) {
      await this.throwStockInsuficiente(dto.productId, sector, -delta);
    }

    return this.registrarEnLibro({
      tipo: TipoMovimiento.AJUSTE,
      productId: dto.productId,
      sectorOrigenId: sector,
      cantidad: -delta,
      motivo: dto.motivo,
      usuarioId,
    });
  }

  /**
   * Deja los saldos de un producto como pide el formulario del producto, en
   * un solo request. Antes el front mandaba un movimiento por sector, en
   * serie, y cada uno hacía unas ocho consultas a Atlas.
   *
   * Lecturas en paralelo, escrituras en paralelo y el libro en un insertMany.
   * Cada sector trae el saldo que el usuario tenía en pantalla (`esperado`),
   * y cada escritura exige que el saldo siga siendo ese. Si una venta lo
   * cambió mientras el formulario estaba abierto, o entre la lectura y la
   * escritura, responde 409; en el segundo caso antes deshace las escrituras
   * que ya entraron, así nunca queda un reparto a medias.
   */
  async fijarSaldos(
    dto: FijarSaldosDto,
    usuarioId?: string,
  ): Promise<StockSectorResponseDto[]> {
    const { productId } = dto;
    const sectorIds = dto.saldos.map((s) => s.sectorId);

    if (new Set(sectorIds).size !== sectorIds.length) {
      throw new BadRequestException('Hay un sector repetido en el reparto.');
    }

    const [producto, sectores, saldos] = await Promise.all([
      this.productModel.findById(productId).select('nombre').lean().exec(),
      this.sectorModel
        .find({ _id: { $in: sectorIds.map((id) => new Types.ObjectId(id)) } })
        .select('nombre activo')
        .lean()
        .exec(),
      this.stockSectorModel
        .find({ productId: new Types.ObjectId(productId) })
        .exec(),
    ]);

    if (!producto) {
      throw new NotFoundException('Producto no encontrado');
    }

    const sectorPorId = new Map(
      sectores.map((s) => [
        s._id.toString(),
        { nombre: s.nombre, activo: s.activo },
      ]),
    );
    const faltante = sectorIds.find((id) => !sectorPorId.has(id));
    if (faltante) {
      throw new NotFoundException('Sector no encontrado');
    }

    const saldoPorSector = new Map<string, StockSectorDocument>(
      saldos.map((s) => [s.sectorId.toString(), s]),
    );

    const conflicto = () =>
      new ConflictException(
        `El stock de "${producto.nombre}" cambió mientras lo editabas (por ejemplo, por una venta). Volvé a abrir el producto y probá de nuevo.`,
      );

    // El reparto se calcula sobre lo que el usuario vio, no sobre lo que hay
    // ahora: si difieren, alguien movió stock mientras el formulario estaba
    // abierto, y aplicar el pedido pisaría ese movimiento sin aviso.
    const desactualizado = dto.saldos.some(
      (s) => (saldoPorSector.get(s.sectorId)?.cantidad ?? 0) !== s.esperado,
    );
    if (desactualizado) {
      throw conflicto();
    }

    const cambios: CambioSaldo[] = dto.saldos
      .map((s) => ({
        sectorId: s.sectorId,
        actual: s.esperado,
        nuevo: s.cantidad,
      }))
      .filter((c) => c.nuevo !== c.actual);

    // Un sector inactivo puede vaciarse pero no recibir (ver
    // assertSectorPuedeRecibir).
    for (const cambio of cambios) {
      const sector = sectorPorId.get(cambio.sectorId);
      if (cambio.nuevo > cambio.actual && sector && !sector.activo) {
        throw new ConflictException(
          `El sector "${sector.nombre}" está inactivo y no puede recibir stock.`,
        );
      }
    }

    if (cambios.length > 0) {
      const resultados = await Promise.allSettled(
        cambios.map((c) =>
          this.fijarSiNoCambio(productId, c.sectorId, c.actual, c.nuevo),
        ),
      );

      const aplicados = cambios.filter(
        (_, i) => resultados[i].status === 'fulfilled' && resultados[i].value,
      );

      if (aplicados.length !== cambios.length) {
        // Compensación: los que entraron vuelven a su valor anterior.
        await Promise.allSettled(
          aplicados.map((c) =>
            this.fijarSiNoCambio(productId, c.sectorId, c.nuevo, c.actual),
          ),
        );
        const error = resultados.find(
          (r): r is PromiseRejectedResult => r.status === 'rejected',
        );
        if (error) {
          throw error.reason;
        }
        throw conflicto();
      }

      resultados.forEach((r) => {
        if (r.status === 'fulfilled' && r.value) {
          saldoPorSector.set(r.value.sectorId.toString(), r.value);
        }
      });

      await this.movimientoModel.insertMany(
        planificarReparto(cambios).map((paso) => ({
          tipo: paso.tipo,
          productId: new Types.ObjectId(productId),
          ...(paso.sectorOrigenId
            ? { sectorOrigenId: new Types.ObjectId(paso.sectorOrigenId) }
            : {}),
          ...(paso.sectorDestinoId
            ? { sectorDestinoId: new Types.ObjectId(paso.sectorDestinoId) }
            : {}),
          cantidad: paso.cantidad,
          motivo: paso.motivo,
          ...(usuarioId ? { usuarioId: new Types.ObjectId(usuarioId) } : {}),
          fecha: new Date(),
        })),
      );
    }

    // Los saldos de sectores que no vinieron en el pedido tambien se
    // devuelven, con sus nombres: el front recibe el reparto completo.
    const faltanNombres = [...saldoPorSector.keys()].filter(
      (id) => !sectorPorId.has(id),
    );
    const nombres = faltanNombres.length
      ? await this.buildNombres({ sectorIds: faltanNombres, productIds: [] })
      : undefined;
    nombres?.sectores.forEach((valor, id) => sectorPorId.set(id, valor));

    const contexto: NombresContext = {
      productos: new Map([[productId, producto.nombre]]),
      sectores: sectorPorId,
    };

    return [...saldoPorSector.values()]
      .map((saldo) => this.mapSaldoToDto(saldo, contexto))
      .sort((a, b) => a.sectorNombre.localeCompare(b.sectorNombre, 'es'));
  }

  // ------------------------------------------------------------ saldos (base)

  async getSaldo(productId: string, sectorId: string): Promise<number> {
    const saldo = await this.stockSectorModel
      .findOne({
        productId: new Types.ObjectId(productId),
        sectorId: new Types.ObjectId(sectorId),
      })
      .exec();

    return saldo?.cantidad ?? 0;
  }

  // ------------------------------------------------- API para otros modulos

  /**
   * Total por producto sumando todos los sectores. Lo usa ProductsService
   * para exponer `stock` sin que el consumidor cruce colecciones. Una sola
   * consulta por request, igual que el contexto de precios.
   */
  async sumByProduct(productId?: string): Promise<Map<string, number>> {
    // La suma la hace Mongo: viaja una fila por producto, no una por saldo.
    // Con productId se acota a ese producto (findOne, create, update, remove).
    const filas = await this.stockSectorModel
      .aggregate<{ _id: Types.ObjectId; total: number }>([
        ...(productId
          ? [{ $match: { productId: new Types.ObjectId(productId) } }]
          : []),
        { $group: { _id: '$productId', total: { $sum: '$cantidad' } } },
      ])
      .exec();

    return new Map(filas.map((fila) => [fila._id.toString(), fila.total]));
  }

  /** Descuenta una linea de venta del sector y la deja asentada en el libro. */
  async descontarPorVenta(
    productId: string,
    sectorId: string,
    cantidad: number,
    saleId: string,
    usuarioId?: string,
  ): Promise<void> {
    const descontado = await this.decrementarCondicional(
      productId,
      sectorId,
      cantidad,
    );
    if (!descontado) {
      await this.throwStockInsuficiente(productId, sectorId, cantidad);
    }

    await this.crearMovimiento({
      tipo: TipoMovimiento.SALIDA,
      productId,
      sectorOrigenId: sectorId,
      cantidad,
      motivo: 'Venta',
      saleId,
      usuarioId,
    });
  }

  /** Devuelve stock al sector cuando una venta se edita o se anula. */
  async reponerPorVenta(
    productId: string,
    sectorId: string,
    cantidad: number,
    saleId: string,
    usuarioId?: string,
    motivo = 'Anulación de venta',
  ): Promise<void> {
    await this.incrementar(productId, sectorId, cantidad);

    await this.crearMovimiento({
      tipo: TipoMovimiento.ENTRADA,
      productId,
      sectorDestinoId: sectorId,
      cantidad,
      motivo,
      saleId,
      usuarioId,
    });
  }

  /**
   * Borra los saldos de un producto eliminado, para no dejar filas huerfanas
   * que sigan sumando al total. Los movimientos se conservan: son historia.
   */
  async eliminarSaldosDeProducto(productId: string): Promise<void> {
    // Solo quedan filas en cero: ProductsService no deja borrar un producto
    // con stock, asi toda baja de unidades pasa por el libro.
    await this.stockSectorModel
      .deleteMany({ productId: new Types.ObjectId(productId) })
      .exec();
  }

  /** Valida que el sector exista y acepte operaciones. Lo usa SalesService. */
  async assertSectorOperativo(sectorId: string): Promise<void> {
    const sector = await this.assertSectorExiste(sectorId);
    if (!sector.activo) {
      throw new ConflictException(
        `El sector "${sector.nombre}" está inactivo y no admite ventas.`,
      );
    }
  }

  // ------------------------------------------------------- saldos (internos)

  /**
   * Lleva un saldo de `esperado` a `nuevo` solo si sigue en `esperado`.
   * Devuelve null si alguien lo cambió en el medio. Con `esperado` en 0 la
   * fila puede no existir todavía, así que se crea; si ya existía con otro
   * valor, el índice único rechaza el alta y también se devuelve null.
   */
  private async fijarSiNoCambio(
    productId: string,
    sectorId: string,
    esperado: number,
    nuevo: number,
  ): Promise<StockSectorDocument | null> {
    try {
      return await this.stockSectorModel
        .findOneAndUpdate<StockSectorDocument>(
          {
            productId: new Types.ObjectId(productId),
            sectorId: new Types.ObjectId(sectorId),
            cantidad: esperado,
          },
          { $set: { cantidad: nuevo } },
          { new: true, upsert: esperado === 0, setDefaultsOnInsert: false },
        )
        .exec();
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Descuento atomico condicional: el filtro exige que haya saldo suficiente,
   * asi que la comprobacion y la resta ocurren en la misma operacion y no hay
   * ventana entre validar y escribir. Devuelve false si no alcanzaba.
   */
  private async decrementarCondicional(
    productId: string,
    sectorId: string,
    cantidad: number,
  ): Promise<boolean> {
    const actualizado = await this.stockSectorModel
      .findOneAndUpdate(
        {
          productId: new Types.ObjectId(productId),
          sectorId: new Types.ObjectId(sectorId),
          cantidad: { $gte: cantidad },
        },
        { $inc: { cantidad: -cantidad } },
        { new: true },
      )
      .exec();

    return actualizado !== null;
  }

  private async incrementar(
    productId: string,
    sectorId: string,
    cantidad: number,
  ): Promise<void> {
    const filtro = {
      productId: new Types.ObjectId(productId),
      sectorId: new Types.ObjectId(sectorId),
    };

    try {
      await this.stockSectorModel
        .findOneAndUpdate(
          filtro,
          { $inc: { cantidad } },
          // setDefaultsOnInsert en false a proposito: el unico default del
          // schema es cantidad = 0 y ya esta en el update via $inc, asi que
          // dejarlo activo arriesga un conflicto de rutas en el upsert.
          // productId y sectorId los toma Mongo del filtro.
          { new: true, upsert: true, setDefaultsOnInsert: false },
        )
        .exec();
    } catch (error) {
      // Dos upserts simultaneos sobre el mismo par chocan contra el indice
      // unico. La fila ya existe, asi que el reintento es un $inc comun.
      if (!this.isDuplicateKeyError(error)) {
        throw error;
      }
      await this.stockSectorModel
        .findOneAndUpdate(filtro, { $inc: { cantidad } }, { new: true })
        .exec();
    }
  }

  // ------------------------------------------------------------------ helpers

  private async registrarEnLibro(
    datos: DatosMovimiento,
  ): Promise<MovimientoStockResponseDto> {
    // Sólo hacen falta los nombres de este movimiento, y se leen a la vez que
    // se escribe la fila del libro.
    const sectorIds = [datos.sectorOrigenId, datos.sectorDestinoId].filter(
      (id): id is string => !!id,
    );
    const [movimiento, nombres] = await Promise.all([
      this.crearMovimiento(datos),
      this.buildNombres({ productIds: [datos.productId], sectorIds }),
    ]);
    return this.mapMovimientoToDto(movimiento, nombres);
  }

  /**
   * Inserta la fila del libro sin resolver nombres. Lo usan los flujos que
   * escriben varios movimientos seguidos (una venta con varias lineas) y no
   * necesitan el DTO de vuelta.
   */
  private async crearMovimiento(
    datos: DatosMovimiento,
  ): Promise<MovimientoStockDocument> {
    return this.movimientoModel.create({
      tipo: datos.tipo,
      productId: new Types.ObjectId(datos.productId),
      ...(datos.sectorOrigenId
        ? { sectorOrigenId: new Types.ObjectId(datos.sectorOrigenId) }
        : {}),
      ...(datos.sectorDestinoId
        ? { sectorDestinoId: new Types.ObjectId(datos.sectorDestinoId) }
        : {}),
      cantidad: datos.cantidad,
      ...(datos.motivo ? { motivo: datos.motivo } : {}),
      ...(datos.saleId ? { saleId: new Types.ObjectId(datos.saleId) } : {}),
      ...(datos.usuarioId
        ? { usuarioId: new Types.ObjectId(datos.usuarioId) }
        : {}),
      fecha: new Date(),
    });
  }

  private requireSector(valor: string | undefined, campo: string): string {
    if (!valor) {
      throw new BadRequestException(`Falta ${campo} para este movimiento.`);
    }
    return valor;
  }

  private rejectSector(
    valor: string | undefined,
    campo: string,
    contexto: string,
  ): void {
    if (valor) {
      throw new BadRequestException(
        `No corresponde enviar ${campo} en ${contexto}.`,
      );
    }
  }

  private requireCantidadPositiva(cantidad: number): void {
    if (cantidad < 1) {
      throw new BadRequestException('La cantidad debe ser al menos 1.');
    }
  }

  private async assertSectorExiste(sectorId: string): Promise<SectorDocument> {
    const sector = await this.sectorModel.findById(sectorId).exec();
    if (!sector) {
      throw new NotFoundException('Sector no encontrado');
    }
    return sector;
  }

  /**
   * Un sector inactivo puede vaciarse pero no recibir: si no, el stock que
   * quedo adentro no habria forma de sacarlo.
   */
  private async assertSectorPuedeRecibir(sectorId: string): Promise<void> {
    const sector = await this.assertSectorExiste(sectorId);
    if (!sector.activo) {
      throw new ConflictException(
        `El sector "${sector.nombre}" está inactivo y no puede recibir stock.`,
      );
    }
  }

  private async throwStockInsuficiente(
    productId: string,
    sectorId: string,
    solicitado: number,
  ): Promise<never> {
    const [producto, sector, disponible] = await Promise.all([
      this.productModel.findById(productId).exec(),
      this.sectorModel.findById(sectorId).exec(),
      this.getSaldo(productId, sectorId),
    ]);

    const nombreProducto = producto?.nombre ?? productId;
    const nombreSector = sector?.nombre ?? sectorId;

    throw new ConflictException(
      `Stock insuficiente de "${nombreProducto}" en "${nombreSector}". Disponible: ${disponible}, solicitado: ${solicitado}.`,
    );
  }

  /**
   * Nombres de productos y sectores. Sin filtro trae todos (listados); con
   * ids trae sólo esos, para no leer el catálogo entero cuando la respuesta
   * nombra uno o dos.
   */
  private async buildNombres(filtro?: {
    productIds?: string[];
    sectorIds?: string[];
  }): Promise<NombresContext> {
    const porIds = (ids?: string[]) =>
      ids ? { _id: { $in: ids.map((id) => new Types.ObjectId(id)) } } : {};

    const [productos, sectores] = await Promise.all([
      filtro?.productIds?.length === 0
        ? Promise.resolve([])
        : this.productModel
            .find(porIds(filtro?.productIds))
            .select('nombre')
            .lean()
            .exec(),
      filtro?.sectorIds?.length === 0
        ? Promise.resolve([])
        : this.sectorModel
            .find(porIds(filtro?.sectorIds))
            .select('nombre activo')
            .lean()
            .exec(),
    ]);

    return {
      productos: new Map(
        productos.map((producto) => [producto._id.toString(), producto.nombre]),
      ),
      sectores: new Map(
        sectores.map((sector) => [
          sector._id.toString(),
          {
            nombre: sector.nombre,
            activo: sector.activo,
          },
        ]),
      ),
    };
  }

  private mapSaldoToDto(
    saldo: StockSectorDocument,
    nombres: NombresContext,
  ): StockSectorResponseDto {
    const plain = saldo.toObject();
    const idProducto = saldo.productId.toString();
    const idSector = saldo.sectorId.toString();

    const source: StockSectorContract = {
      id: saldo.id as string,
      productId: idProducto,
      productNombre: nombres.productos.get(idProducto) ?? '',
      sectorId: idSector,
      sectorNombre: nombres.sectores.get(idSector)?.nombre ?? '',
      cantidad: plain.cantidad,
      createdAt: (plain as { createdAt?: Date }).createdAt,
      updatedAt: (plain as { updatedAt?: Date }).updatedAt,
    };

    return plainToInstance(StockSectorResponseDto, source, {
      excludeExtraneousValues: true,
    });
  }

  private mapMovimientoToDto(
    movimiento: MovimientoStockDocument,
    nombres: NombresContext,
  ): MovimientoStockResponseDto {
    const plain = movimiento.toObject();
    const idProducto = movimiento.productId.toString();
    const idOrigen = movimiento.sectorOrigenId?.toString();
    const idDestino = movimiento.sectorDestinoId?.toString();

    const source: MovimientoStockContract = {
      id: movimiento.id as string,
      tipo: plain.tipo,
      productId: idProducto,
      productNombre: nombres.productos.get(idProducto) ?? '',
      sectorOrigenId: idOrigen,
      sectorOrigenNombre: idOrigen
        ? (nombres.sectores.get(idOrigen)?.nombre ?? '')
        : undefined,
      sectorDestinoId: idDestino,
      sectorDestinoNombre: idDestino
        ? (nombres.sectores.get(idDestino)?.nombre ?? '')
        : undefined,
      cantidad: plain.cantidad,
      motivo: plain.motivo,
      saleId: movimiento.saleId?.toString(),
      usuarioId: movimiento.usuarioId?.toString(),
      fecha: plain.fecha,
    };

    return plainToInstance(MovimientoStockResponseDto, source, {
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
}
