
import { Controller, Get, Query, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  ExpensesReportService,
  GananciasResponse,
  PuntoEquilibrioResponse,
} from './expenses-report.service';

@ApiTags('expenses')
@Controller('expenses')
export class ExpensesReportController {
  constructor(
    private readonly expensesReportService: ExpensesReportService,
  ) {}

  @Get('punto-equilibrio')
  @ApiOperation({
    summary:
      'Punto de equilibrio: global ponderado (principal) + margen por producto',
  })
  async getPuntoEquilibrio(): Promise<PuntoEquilibrioResponse> {
    return this.expensesReportService.getPuntoEquilibrio();
  }

  @Get('ganancias')
  @ApiOperation({ summary: 'Ganancia neta (ingresos vs egresos) por período' })
  @ApiQuery({ name: 'fechaDesde', required: false })
  @ApiQuery({ name: 'fechaHasta', required: false })
  async getGanancias(
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
  ): Promise<GananciasResponse> {
    return this.expensesReportService.getGanancias(fechaDesde, fechaHasta);
  }

  @Get('export')
  @ApiOperation({ summary: 'Exportar reporte mensual de gastos/ingresos a Excel' })
  @ApiQuery({ name: 'fechaDesde', required: false })
  @ApiQuery({ name: 'fechaHasta', required: false })
  async exportExcel(
    @Res() res: FastifyReply,
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
  ) {
    const { workbook, fileName } =
      await this.expensesReportService.generateExpensesExcel(
        fechaDesde,
        fechaHasta,
      );

    const buffer = await workbook.xlsx.writeBuffer();

    res.header(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.header('Content-Disposition', `attachment; filename="${fileName}"`);
    res.header('Access-Control-Expose-Headers', 'Content-Disposition');

    return res.send(buffer);
  }
}
