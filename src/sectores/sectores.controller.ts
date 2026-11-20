
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
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateSectorDto } from './dto/create-sector.dto';
import { SectorResponseDto } from './dto/sector-response.dto';
import { UpdateSectorDto } from './dto/update-sector.dto';
import { SectoresService } from './sectores.service';

@ApiTags('sectores')
@Controller('sectores')
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class SectoresController {
  constructor(private readonly sectoresService: SectoresService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo sector' })
  @ApiResponse({ status: HttpStatus.CREATED, type: SectorResponseDto })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Ya existe un sector con ese nombre',
  })
  async create(
    @Body() createSectorDto: CreateSectorDto,
  ): Promise<SectorResponseDto> {
    return this.sectoresService.create(createSectorDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar sectores' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: SectorResponseDto,
    isArray: true,
  })
  async findAll(): Promise<SectorResponseDto[]> {
    return this.sectoresService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un sector por ID' })
  @ApiResponse({ status: HttpStatus.OK, type: SectorResponseDto })
  async findOne(@Param('id') id: string): Promise<SectorResponseDto> {
    return this.sectoresService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un sector' })
  @ApiResponse({ status: HttpStatus.OK, type: SectorResponseDto })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Ya existe un sector con ese nombre',
  })
  async update(
    @Param('id') id: string,
    @Body() updateSectorDto: UpdateSectorDto,
  ): Promise<SectorResponseDto> {
    return this.sectoresService.update(id, updateSectorDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un sector' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Sector eliminado correctamente',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'El sector todavía tiene stock',
  })
  async remove(@Param('id') id: string): Promise<void> {
    await this.sectoresService.remove(id);
  }
}
