
import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  ForbiddenException,
  Get,
  HttpStatus,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../shared/enums/user-role.enum';
import type { UserDocument } from '../users/schemas/user.schema';
import { CreateMovimientoDto } from './dto/create-movimiento.dto';
import { FijarSaldosDto } from './dto/fijar-saldos.dto';
import { MovimientoStockResponseDto } from './dto/movimiento-stock-response.dto';
import { QueryMovimientosDto } from './dto/query-movimientos.dto';
import { QueryResumenDto } from './dto/query-resumen.dto';
import { QueryStockDto } from './dto/query-stock.dto';
import { StockResumenResponseDto } from './dto/stock-resumen-response.dto';
import { StockSectorResponseDto } from './dto/stock-sector-response.dto';
import { StockService } from './stock.service';

@ApiTags('stock')
@Controller('stock')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar saldos de stock por producto y sector',
    description:
      'Un vendedor ve el suyo. Un admin ve todos, o el que indique en sectorId.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: StockSectorResponseDto,
    isArray: true,
  })
  async findSaldos(
    @Query() query: QueryStockDto,
    @GetUser() user: UserDocument,
  ): Promise<StockSectorResponseDto[]> {
    const sectorId = this.sectorEfectivo(user, query.sectorId);
    return this.stockService.findSaldos({
      ...query,
      ...(sectorId ? { sectorId } : {}),
    });
  }

  @Get('resumen')
  @ApiOperation({
    summary: 'Stock general del emprendimiento, con desglose por sector',
    description:
      'Abierto a cualquier usuario autenticado: es la vista de control del total.',
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
    @GetUser() user: UserDocument,
  ): Promise<MovimientoStockResponseDto[]> {
    const sectorId = this.sectorEfectivo(user, query.sectorId);
    return this.stockService.findMovimientos({
      ...query,
      ...(sectorId ? { sectorId } : {}),
    });
  }

  @Post('movimientos')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Registrar un movimiento (entrada, salida, transferencia, ajuste)',
    description:
      'Solo admin: mover stock entre sectores o corregir saldos es administración.',
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

  @Put('saldos')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Fijar el reparto de un producto entre sectores',
    description:
      'Solo admin. Recibe el saldo final de cada sector y registra en el libro las transferencias, entradas y ajustes que llevan a ese reparto, todo en un request.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: StockSectorResponseDto,
    isArray: true,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Sector inactivo, o el saldo cambió mientras se editaba',
  })
  async fijarSaldos(
    @Body() fijarSaldosDto: FijarSaldosDto,
    @GetUser() user: UserDocument,
  ): Promise<StockSectorResponseDto[]> {
    const usuarioId = String(user.id ?? user._id);
    return this.stockService.fijarSaldos(fijarSaldosDto, usuarioId);
  }

  /**
   * Sector por el que filtrar una consulta.
   *
   * El admin ve todo, o lo que pida. Cualquier otro rol queda atado al suyo:
   * sin sector asignado no hay nada que pueda mirar, y pedir otro es mirar
   * stock ajeno. El resumen consolidado no pasa por aca a proposito, porque
   * ver el total del emprendimiento es justamente lo que se quiere habilitar.
   */
  private sectorEfectivo(
    user: UserDocument,
    pedido?: string,
  ): string | undefined {
    if (user.roles.includes(UserRole.ADMIN)) {
      return pedido;
    }

    const propio = user.sectorId ? user.sectorId.toString() : undefined;
    if (!propio) {
      throw new ForbiddenException(
        'No tenés un sector asignado. Pedile a un admin que te asigne uno.',
      );
    }

    if (pedido && pedido !== propio) {
      throw new ForbiddenException(
        'Solo podés consultar el stock de tu sector.',
      );
    }

    return propio;
  }
}
