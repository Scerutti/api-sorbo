
import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  HttpStatus,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { UserDocument } from '../users/schemas/user.schema';
import { CreateMovimientoDto } from './dto/create-movimiento.dto';
import { MovimientoStockResponseDto } from './dto/movimiento-stock-response.dto';
import { QueryMovimientosDto } from './dto/query-movimientos.dto';
import { QueryResumenDto } from './dto/query-resumen.dto';
import { QueryStockDto } from './dto/query-stock.dto';
import { StockResumenResponseDto } from './dto/stock-resumen-response.dto';
import { StockSectorResponseDto } from './dto/stock-sector-response.dto';
import { StockService } from './stock.service';

@ApiTags('stock')
@Controller('stock')
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get()
  @ApiOperation({ summary: 'Listar saldos de stock por producto y sector' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: StockSectorResponseDto,
    isArray: true,
  })
  async findSaldos(
    @Query() query: QueryStockDto,
  ): Promise<StockSectorResponseDto[]> {
    return this.stockService.findSaldos(query);
  }

  @Get('resumen')
  @ApiOperation({
    summary: 'Stock general del emprendimiento, con desglose por sector',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: StockResumenResponseDto,
    isArray: true,
  })
  async findResumen(
    @Query() query: QueryResumenDto,
  ): Promise<StockResumenResponseDto[]> {
    return this.stockService.findResumen(query.productId);
  }

  @Get('movimientos')
  @ApiOperation({ summary: 'Listar el libro de movimientos de stock' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: MovimientoStockResponseDto,
    isArray: true,
  })
  async findMovimientos(
    @Query() query: QueryMovimientosDto,
  ): Promise<MovimientoStockResponseDto[]> {
    return this.stockService.findMovimientos(query);
  }

  @Post('movimientos')
  @ApiOperation({
    summary: 'Registrar un movimiento (entrada, salida, transferencia, ajuste)',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: MovimientoStockResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Stock insuficiente o sector inactivo',
  })
  async registrarMovimiento(
    @Body() createMovimientoDto: CreateMovimientoDto,
    @GetUser() user: UserDocument,
  ): Promise<MovimientoStockResponseDto> {
    const usuarioId = String(user.id ?? user._id);
    return this.stockService.registrarMovimiento(
      createMovimientoDto,
      usuarioId,
    );
  }
}
