
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
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateGastoDto } from './dto/create-gasto.dto';
import { GastoResponseDto } from './dto/gasto-response.dto';
import { UpdateGastoDto } from './dto/update-gasto.dto';
import { GastosService } from './gastos.service';

@ApiTags('expenses')
@Controller('expenses/gastos')
@UseInterceptors(ClassSerializerInterceptor)
export class GastosController {
  constructor(private readonly gastosService: GastosService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un gasto base (fijo o variable)' })
  @ApiResponse({ status: HttpStatus.CREATED, type: GastoResponseDto })
  async create(
    @Body() createGastoDto: CreateGastoDto,
  ): Promise<GastoResponseDto> {
    return this.gastosService.create(createGastoDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar gastos base' })
  @ApiResponse({ status: HttpStatus.OK, type: GastoResponseDto, isArray: true })
  async findAll(): Promise<GastoResponseDto[]> {
    return this.gastosService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un gasto base por ID' })
  @ApiResponse({ status: HttpStatus.OK, type: GastoResponseDto })
  async findOne(@Param('id') id: string): Promise<GastoResponseDto> {
    return this.gastosService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un gasto base' })
  @ApiResponse({ status: HttpStatus.OK, type: GastoResponseDto })
  async update(
    @Param('id') id: string,
    @Body() updateGastoDto: UpdateGastoDto,
  ): Promise<GastoResponseDto> {
    return this.gastosService.update(id, updateGastoDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un gasto base' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Gasto eliminado correctamente',
  })
  async remove(@Param('id') id: string): Promise<void> {
    await this.gastosService.remove(id);
  }
}
