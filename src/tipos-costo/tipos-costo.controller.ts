
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
import { CreateTipoCostoDto } from './dto/create-tipo-costo.dto';
import { TipoCostoResponseDto } from './dto/tipo-costo-response.dto';
import { UpdateTipoCostoDto } from './dto/update-tipo-costo.dto';
import { TiposCostoService } from './tipos-costo.service';

@ApiTags('tipos-costo')
@Controller('tipos-costo')
@UseInterceptors(ClassSerializerInterceptor)
export class TiposCostoController {
  constructor(private readonly tiposCostoService: TiposCostoService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo tipo de costo' })
  @ApiResponse({ status: HttpStatus.CREATED, type: TipoCostoResponseDto })
  async create(
    @Body() createTipoCostoDto: CreateTipoCostoDto,
  ): Promise<TipoCostoResponseDto> {
    return this.tiposCostoService.create(createTipoCostoDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar tipos de costo' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: TipoCostoResponseDto,
    isArray: true,
  })
  async findAll(): Promise<TipoCostoResponseDto[]> {
    return this.tiposCostoService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un tipo de costo por ID' })
  @ApiResponse({ status: HttpStatus.OK, type: TipoCostoResponseDto })
  async findOne(@Param('id') id: string): Promise<TipoCostoResponseDto> {
    return this.tiposCostoService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un tipo de costo' })
  @ApiResponse({ status: HttpStatus.OK, type: TipoCostoResponseDto })
  async update(
    @Param('id') id: string,
    @Body() updateTipoCostoDto: UpdateTipoCostoDto,
  ): Promise<TipoCostoResponseDto> {
    return this.tiposCostoService.update(id, updateTipoCostoDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un tipo de costo' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Tipo de costo eliminado correctamente',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'El tipo de costo esta en uso por costos o productos',
  })
  async remove(@Param('id') id: string): Promise<void> {
    await this.tiposCostoService.remove(id);
  }
}
