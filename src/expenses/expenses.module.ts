
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProductsModule } from '../products/products.module';
import { SalesModule } from '../sales/sales.module';
import { GastoBase, GastoBaseSchema } from './schemas/gasto-base.schema';
import { Inversion, InversionSchema } from './schemas/inversion.schema';
import { GastosController } from './gastos.controller';
import { GastosService } from './gastos.service';
import { InversionesController } from './inversiones.controller';
import { InversionesService } from './inversiones.service';
import { ExpensesReportController } from './expenses-report.controller';
import { ExpensesReportService } from './expenses-report.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: GastoBase.name, schema: GastoBaseSchema },
      { name: Inversion.name, schema: InversionSchema },
    ]),
    ProductsModule,
    SalesModule,
  ],
  controllers: [
    GastosController,
    InversionesController,
    ExpensesReportController,
  ],
  providers: [GastosService, InversionesService, ExpensesReportService],
  exports: [GastosService],
})
export class ExpensesModule {}
