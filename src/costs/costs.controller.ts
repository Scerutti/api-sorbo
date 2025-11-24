
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
import { CreateCostDto } from './dto/create-cost.dto';
import { CostResponseDto } from './dto/cost-response.dto';
import { UpdateCostDto } from './dto/update-cost.dto';
import { CostsService } from './costs.service';

@ApiTags('costs')
@Controller('costs')
@UseInterceptors(ClassSerializerInterceptor)
export class CostsController {
  constructor(private readonly costsService: CostsService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo costo' })
  @ApiResponse({ status: HttpStatus.CREATED, type: CostResponseDto })
  async create(@Body() createCostDto: CreateCostDto): Promise<CostResponseDto> {
    return this.costsService.create(createCostDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar costos' })
  @ApiResponse({ status: HttpStatus.OK, type: CostResponseDto, isArray: true })
  async findAll(): Promise<CostResponseDto[]> {
    return this.costsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un costo por ID' })
  @ApiResponse({ status: HttpStatus.OK, type: CostResponseDto })
  async findOne(@Param('id') id: string): Promise<CostResponseDto> {
    return this.costsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un costo' })
  @ApiResponse({ status: HttpStatus.OK, type: CostResponseDto })
  async update(
    @Param('id') id: string,
    @Body() updateCostDto: UpdateCostDto,
  ): Promise<CostResponseDto> {
    return this.costsService.update(id, updateCostDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un costo' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Costo eliminado correctamente',
  })
  async remove(@Param('id') id: string): Promise<void> {
    await this.costsService.remove(id);
  }
}
