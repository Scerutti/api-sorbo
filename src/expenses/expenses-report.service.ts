
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { GastoClasificacion } from '../shared/enums/gasto-clasificacion.enum';
import { ProductsService } from '../products/products.service';
import { SalesService } from '../sales/sales.service';
import { GastosService } from './gastos.service';
import { InversionesService } from './inversiones.service';

export interface BreakevenPorProducto {
  productId: string;
  nombre: string;
  precioVenta: number;
  costoVariable: number;
  margenContribucion: number;
  margenContribucionPct: number;
  soldCount: number;
  puntoEquilibrioInformativo: number | null;
}

export interface PuntoEquilibrioResponse {
  costoFijoTotal: number;
  global: {
    margenPromedioPonderado: number;
    puntoEquilibrio: number | null;
  };
  porProducto: BreakevenPorProducto[];
}

export interface GananciasResponse {
  fechaDesde: string | null;
  fechaHasta: string | null;
  ingresos: number;
  gastosFijos: number;
  gastosVariables: number;
  inversiones: number;
  egresosTotal: number;
  gananciaNeta: number;
}

@Injectable()
export class ExpensesReportService {
  constructor(
    private readonly gastosService: GastosService,
    private readonly inversionesService: InversionesService,
    @Inject(forwardRef(() => ProductsService))
    private readonly productsService: ProductsService,
    private readonly salesService: SalesService,
  ) {}

  async getPuntoEquilibrio(): Promise<PuntoEquilibrioResponse> {
    const costoFijoTotal =
      await this.gastosService.sumMontoTotalByClasificacion(
        GastoClasificacion.FIJO,
      );

    const productos = await this.productsService.findAll();

    const porProducto: BreakevenPorProducto[] = productos.map((producto) => {
      const precioVenta = producto.precioVenta ?? 0;
      const costoVariable = producto.precioCosto ?? 0;
      const margenContribucion = precioVenta - costoVariable;
      const margenContribucionPct =
        precioVenta > 0 ? margenContribucion / precioVenta : 0;
      const puntoEquilibrioInformativo =
        margenContribucion > 0 ? costoFijoTotal / margenContribucion : null;

      return {
        productId: producto.id,
        nombre: producto.nombre,
        precioVenta,
        costoVariable,
        margenContribucion,
        margenContribucionPct,
        soldCount: producto.soldCount ?? 0,
        puntoEquilibrioInformativo,
      };
    });

    // PE global ponderado por unidades vendidas (métrica principal).
    const totalVendidas = porProducto.reduce((acc, p) => acc + p.soldCount, 0);
    let margenPromedioPonderado = 0;
    if (totalVendidas > 0) {
      const sumaPonderada = porProducto.reduce(
        (acc, p) => acc + p.margenContribucion * p.soldCount,
        0,
      );
      margenPromedioPonderado = sumaPonderada / totalVendidas;
    } else if (porProducto.length > 0) {
      // Sin ventas registradas: promedio simple de los márgenes como referencia.
      margenPromedioPonderado =
        porProducto.reduce((acc, p) => acc + p.margenContribucion, 0) /
        porProducto.length;
    }

    const puntoEquilibrio =
      margenPromedioPonderado > 0
        ? costoFijoTotal / margenPromedioPonderado
        : null;

    return {
      costoFijoTotal,
      global: { margenPromedioPonderado, puntoEquilibrio },
      porProducto,
    };
  }

  async getGanancias(
    fechaDesde?: string,
    fechaHasta?: string,
  ): Promise<GananciasResponse> {
    const [ingresos, gastosFijos, gastosVariables, inversiones] =
      await Promise.all([
        this.salesService.sumTotalByDateRange(fechaDesde, fechaHasta),
        this.gastosService.sumMontoTotalByClasificacion(
          GastoClasificacion.FIJO,
        ),
        this.gastosService.sumMontoTotalByClasificacion(
          GastoClasificacion.VARIABLE,
        ),
        this.inversionesService.sumMontoByDateRange(fechaDesde, fechaHasta),
      ]);

    const egresosTotal = gastosFijos + gastosVariables + inversiones;
    const gananciaNeta = ingresos - egresosTotal;

    return {
      fechaDesde: fechaDesde ?? null,
      fechaHasta: fechaHasta ?? null,
      ingresos,
      gastosFijos,
      gastosVariables,
      inversiones,
      egresosTotal,
      gananciaNeta,
    };
  }

  /**
   * Genera el reporte mensual (Excel) reutilizando el patrón de exceljs ya
   * usado en SalesService.generateSaleExcel.
   */
  async generateExpensesExcel(
    fechaDesde?: string,
    fechaHasta?: string,
  ): Promise<{ workbook: ExcelJS.Workbook; fileName: string }> {
    const [ganancias, gastos, inversiones, ventas] = await Promise.all([
      this.getGanancias(fechaDesde, fechaHasta),
      this.gastosService.findAll(),
      this.inversionesService.findAll(fechaDesde, fechaHasta),
      this.salesService.findByDateRange(fechaDesde, fechaHasta),
    ]);

    const workbook = new ExcelJS.Workbook();
    const moneyFmt = '$#,##0.00';
    const styleHeader = (row: ExcelJS.Row) => {
      row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4F81BD' },
      };
      row.alignment = { vertical: 'middle', horizontal: 'center' };
    };

    // --- Hoja Resumen ---
    const resumen = workbook.addWorksheet('Resumen');
    resumen.columns = [
      { header: 'Concepto', key: 'concepto', width: 30 },
      { header: 'Monto', key: 'monto', width: 20 },
    ];
    styleHeader(resumen.getRow(1));
    resumen.addRows([
      { concepto: 'Ingresos (Ventas)', monto: ganancias.ingresos },
      { concepto: 'Gastos Fijos', monto: ganancias.gastosFijos },
      { concepto: 'Gastos Variables', monto: ganancias.gastosVariables },
      { concepto: 'Inversiones', monto: ganancias.inversiones },
      { concepto: 'Egresos Totales', monto: ganancias.egresosTotal },
      { concepto: 'Ganancia Neta', monto: ganancias.gananciaNeta },
    ]);
    resumen.getColumn('monto').numFmt = moneyFmt;
    resumen.getRow(7).font = { bold: true };

    // --- Hoja Ventas ---
    const hojaVentas = workbook.addWorksheet('Ventas');
    hojaVentas.columns = [
      { header: 'Fecha', key: 'fecha', width: 18 },
      { header: 'Mayorista', key: 'mayorista', width: 12 },
      { header: 'Total', key: 'total', width: 18 },
    ];
    styleHeader(hojaVentas.getRow(1));
    ventas.forEach((venta) => {
      hojaVentas.addRow({
        fecha: venta.fecha
          ? new Date(venta.fecha).toISOString().split('T')[0]
          : '',
        mayorista: venta.esMayorista ? 'Sí' : 'No',
        total: venta.total,
      });
    });
    hojaVentas.getColumn('total').numFmt = moneyFmt;

    // --- Hoja Gastos ---
    const hojaGastos = workbook.addWorksheet('Gastos');
    hojaGastos.columns = [
      { header: 'Nombre', key: 'nombre', width: 30 },
      { header: 'Clasificación', key: 'clasificacion', width: 16 },
      { header: 'Monto Total', key: 'montoTotal', width: 16 },
      { header: 'Por Paquetes', key: 'porPaquetes', width: 14 },
      { header: 'Valor Unitario', key: 'valorUnitario', width: 16 },
    ];
    styleHeader(hojaGastos.getRow(1));
    gastos.forEach((gasto) => {
      hojaGastos.addRow({
        nombre: gasto.nombre,
        clasificacion: gasto.clasificacion,
        montoTotal: gasto.montoTotal,
        porPaquetes: gasto.porPaquetes,
        valorUnitario: gasto.valorUnitario,
      });
    });
    hojaGastos.getColumn('montoTotal').numFmt = moneyFmt;
    hojaGastos.getColumn('valorUnitario').numFmt = moneyFmt;

    // --- Hoja Inversiones ---
    const hojaInversiones = workbook.addWorksheet('Inversiones');
    hojaInversiones.columns = [
      { header: 'Descripción', key: 'descripcion', width: 35 },
      { header: 'Fecha', key: 'fecha', width: 18 },
      { header: 'Monto', key: 'monto', width: 18 },
    ];
    styleHeader(hojaInversiones.getRow(1));
    inversiones.forEach((inversion) => {
      hojaInversiones.addRow({
        descripcion: inversion.descripcion,
        fecha: inversion.fecha
          ? new Date(inversion.fecha).toISOString().split('T')[0]
          : '',
        monto: inversion.monto,
      });
    });
    hojaInversiones.getColumn('monto').numFmt = moneyFmt;

    const desde = fechaDesde ? fechaDesde.split('T')[0] : 'inicio';
    const hasta = fechaHasta ? fechaHasta.split('T')[0] : 'hoy';
    const fileName = `sorbo_sabores_reporte_${desde}_a_${hasta}.xlsx`;

    return { workbook, fileName };
  }
}
