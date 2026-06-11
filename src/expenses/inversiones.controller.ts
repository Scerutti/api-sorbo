
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
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateInversionDto } from './dto/create-inversion.dto';
import { InversionResponseDto } from './dto/inversion-response.dto';
import { UpdateInversionDto } from './dto/update-inversion.dto';
import { InversionesService } from './inversiones.service';

@ApiTags('expenses')
@Controller('expenses/inversiones')
@UseInterceptors(ClassSerializerInterceptor)
export class InversionesController {
  constructor(private readonly inversionesService: InversionesService) {}

  @Post()
  @ApiOperation({ summary: 'Registrar una inversión' })
  @ApiResponse({ status: HttpStatus.CREATED, type: InversionResponseDto })
  async create(
    @Body() createInversionDto: CreateInversionDto,
  ): Promise<InversionResponseDto> {
    return this.inversionesService.create(createInversionDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar inversiones (filtro opcional por fecha)' })
  @ApiQuery({ name: 'fechaDesde', required: false })
  @ApiQuery({ name: 'fechaHasta', required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    type: InversionResponseDto,
    isArray: true,
  })
  async findAll(
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
  ): Promise<InversionResponseDto[]> {
    return this.inversionesService.findAll(fechaDesde, fechaHasta);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una inversión por ID' })
  @ApiResponse({ status: HttpStatus.OK, type: InversionResponseDto })
  async findOne(@Param('id') id: string): Promise<InversionResponseDto> {
    return this.inversionesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una inversión' })
  @ApiResponse({ status: HttpStatus.OK, type: InversionResponseDto })
  async update(
    @Param('id') id: string,
    @Body() updateInversionDto: UpdateInversionDto,
  ): Promise<InversionResponseDto> {
    return this.inversionesService.update(id, updateInversionDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar una inversión' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Inversión eliminada correctamente',
  })
  async remove(@Param('id') id: string): Promise<void> {
    await this.inversionesService.remove(id);
  }
}
