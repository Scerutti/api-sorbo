
import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';
import { CreateSaleDto } from './dto/create-sale.dto';
import { SaleResponseDto } from './dto/sale-response.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { SalesService } from './sales.service';

@ApiTags('sales')
@Controller('sales')
@UseInterceptors(ClassSerializerInterceptor)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Registrar una venta' })
  @ApiResponse({ status: HttpStatus.CREATED, type: SaleResponseDto })
  async create(
    @Body() createSaleDto: CreateSaleDto,
    @GetUser() user: UserDocument,
  ): Promise<SaleResponseDto> {
    const vendedorId = String(user.id ?? user._id);
    return this.salesService.create(createSaleDto, vendedorId);
  }

  @Get()
  @ApiOperation({ summary: 'Listar ventas' })
  @ApiResponse({ status: HttpStatus.OK, type: SaleResponseDto, isArray: true })
  async findAll(): Promise<SaleResponseDto[]> {
    return this.salesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una venta por ID' })
  @ApiResponse({ status: HttpStatus.OK, type: SaleResponseDto })
  async findOne(@Param('id') id: string): Promise<SaleResponseDto> {
    return this.salesService.findOne(id);
  }

  @Get(":id/export")
  @ApiOperation({ summary: "Exportar detalle de venta a Excel" })
  async exportExcel(
    @Param("id") id: string,
    @Res() res: FastifyReply
  ) {
    const { workbook, fileName } = await this.salesService.generateSaleExcel(id);

    const buffer = await workbook.xlsx.writeBuffer();

    res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.header('Content-Disposition', `attachment; filename="${fileName}"`);

    res.header('Access-Control-Expose-Headers', 'Content-Disposition');

    return res.send(buffer);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una venta' })
  @ApiResponse({ status: HttpStatus.OK, type: SaleResponseDto })
  async update(
    @Param('id') id: string,
    @Body() updateSaleDto: UpdateSaleDto,
  ): Promise<SaleResponseDto> {
    return this.salesService.update(id, updateSaleDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar una venta' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Venta eliminada correctamente',
  })
  async remove(@Param('id') id: string): Promise<void> {
    await this.salesService.remove(id);
  }
}
